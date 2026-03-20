import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { SubscriptionStatus, WebhookEventStatus, WebhookProvider } from "@prisma/client";
import { sendOpsAlert } from "../../lib/alerts.js";
import { createMuxAssetClip, getMuxPlaybackUrl } from "../../lib/mux.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../lib/env.js";
import { forbidden, unauthorized } from "../../lib/http.js";
import { getStripeClient, isStripeConfigured } from "../../lib/stripe.js";
import { upsertStripeSubscription } from "../../lib/subscriptions.js";
import { getAuthContext } from "../../lib/viewer.js";

type MuxWebhookEvent = {
  type?: string;
  id?: string;
  data?: {
    id?: string;
    asset_id?: string;
    passthrough?: string | null;
    duration?: number | null;
    errors?: { messages?: string[] } | null;
    playback_ids?: Array<{ id?: string; policy?: string }>;
  };
};

const PREVIEW_PASSTHROUGH_PREFIX = "preview:";
const AUTO_PREVIEW_DURATION_SECONDS = 10;

async function requireAdmin(request: any, reply: any) {
  const auth = await getAuthContext(request);
  if (!auth) {
    unauthorized(reply);
    return null;
  }
  if (auth.user.role !== "ADMIN") {
    forbidden(reply);
    return null;
  }
  return auth;
}

async function createWebhookLog(params: {
  provider: WebhookProvider;
  eventType: string;
  externalId?: string | null;
  payload: unknown;
}) {
  return prisma.webhookEventLog.create({
    data: {
      provider: params.provider,
      eventType: params.eventType,
      externalId: params.externalId ?? null,
      status: WebhookEventStatus.RECEIVED,
      payloadJson: JSON.stringify(params.payload)
    }
  });
}

async function updateWebhookLog(
  id: string,
  params: {
    status: WebhookEventStatus;
    httpStatus?: number;
    errorMessage?: string | null;
  }
) {
  return prisma.webhookEventLog.update({
    where: { id },
    data: {
      status: params.status,
      httpStatus: params.httpStatus ?? null,
      errorMessage: params.errorMessage ?? null,
      processedAt: params.status === WebhookEventStatus.PROCESSED ? new Date() : null
    }
  });
}

async function updateByMuxAssetId(assetId: string, data: Record<string, unknown>) {
  const found = await prisma.contentItem.findFirst({ where: { muxAssetId: assetId } });
  if (!found) {
    return false;
  }
  await prisma.contentItem.update({ where: { id: found.id }, data });
  return true;
}

function parseMuxSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return { timestamp, signatures };
}

function verifyMuxWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  toleranceSeconds?: number;
}) {
  const { timestamp, signatures } = parseMuxSignatureHeader(params.signatureHeader);
  if (!timestamp || !signatures.length) {
    throw new Error("Invalid mux-signature header");
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    throw new Error("Invalid mux-signature timestamp");
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  if (ageSeconds > toleranceSeconds) {
    throw new Error("Mux webhook signature timestamp outside tolerance");
  }

  const signedPayload = `${timestamp}.${params.rawBody}`;
  const expectedSignature = createHmac("sha256", params.secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const matched = signatures.some((signature) => {
    try {
      const receivedBuffer = Buffer.from(signature, "hex");
      return (
        receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer)
      );
    } catch {
      return false;
    }
  });

  if (!matched) {
    throw new Error("Invalid Mux webhook signature");
  }
}

export async function registerWebhookRoutes(app: FastifyInstance) {
  const db = prisma as any;
  app.get("/v1/admin/webhooks", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return reply;
    }

    const query = request.query as { limit?: string; provider?: string; status?: string };
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50));
    const provider =
      query.provider === "stripe"
        ? WebhookProvider.STRIPE
        : query.provider === "mux"
          ? WebhookProvider.MUX
          : undefined;
    const status =
      query.status === "received"
        ? WebhookEventStatus.RECEIVED
        : query.status === "processed"
          ? WebhookEventStatus.PROCESSED
          : query.status === "failed"
            ? WebhookEventStatus.FAILED
            : undefined;

    const logs = await prisma.webhookEventLog.findMany({
      where: {
        provider,
        status
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        provider: log.provider.toLowerCase(),
        eventType: log.eventType,
        externalId: log.externalId,
        status: log.status.toLowerCase(),
        httpStatus: log.httpStatus,
        errorMessage: log.errorMessage,
        processedAt: log.processedAt?.toISOString() ?? null,
        createdAt: log.createdAt.toISOString()
      }))
    };
  });

  app.post("/v1/webhooks/mux", { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers["mux-signature"];
    const rawBody = (request as unknown as { rawBody?: string }).rawBody;
    const body = (request.body ?? {}) as MuxWebhookEvent;
    const log = await createWebhookLog({
      provider: WebhookProvider.MUX,
      eventType: body.type ?? "unknown",
      externalId: body.id ?? body.data?.id ?? null,
      payload: body
    });

    if (env.MUX_WEBHOOK_SECRET && !env.MUX_WEBHOOK_SECRET.startsWith("replace-")) {
      if (!signature || typeof signature !== "string") {
        await updateWebhookLog(log.id, {
          status: WebhookEventStatus.FAILED,
          httpStatus: 401,
          errorMessage: "Missing mux-signature header"
        });
        return reply.status(401).send({ error: "Missing mux-signature header" });
      }

      if (!rawBody) {
        await updateWebhookLog(log.id, {
          status: WebhookEventStatus.FAILED,
          httpStatus: 400,
          errorMessage: "Missing raw webhook body"
        });
        return reply.status(400).send({ error: "Missing raw webhook body" });
      }

      try {
        verifyMuxWebhookSignature({
          rawBody,
          signatureHeader: signature,
          secret: env.MUX_WEBHOOK_SECRET
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid Mux webhook signature";
        await updateWebhookLog(log.id, {
          status: WebhookEventStatus.FAILED,
          httpStatus: 401,
          errorMessage: message
        });
        return reply.status(401).send({ error: "Invalid signature" });
      }
    }

    const type = body.type ?? "";
    const data = body.data ?? {};

    app.log.info({ muxType: type, muxId: data.id }, "Received Mux webhook");

    try {
      if (type === "video.upload.asset_created" && data.id && data.asset_id) {
        await prisma.contentItem.updateMany({
          where: { muxUploadId: data.id },
          data: {
            muxAssetId: data.asset_id,
            videoProvider: "mux",
            videoStatus: "processing",
            videoError: null
          }
        });
      }

      if (type === "video.asset.ready" && data.id) {
        const playbackId = data.playback_ids?.[0]?.id ?? null;
        const passthrough = data.passthrough?.trim() ?? "";

        if (passthrough.startsWith(PREVIEW_PASSTHROUGH_PREFIX)) {
          const contentId = passthrough.slice(PREVIEW_PASSTHROUGH_PREFIX.length);
          if (contentId) {
            await prisma.contentItem.updateMany({
              where: { id: contentId },
              data: {
                heroPreviewUrl: playbackId ? getMuxPlaybackUrl(playbackId) : null
              }
            });
          }
          await updateWebhookLog(log.id, {
            status: WebhookEventStatus.PROCESSED,
            httpStatus: 200
          });
          return { ok: true };
        }

        const updateData: Record<string, unknown> = {
          muxAssetId: data.id,
          muxPlaybackId: playbackId,
          videoProvider: "mux",
          videoStatus: "ready",
          videoError: null
        };

        if (typeof data.duration === "number" && Number.isFinite(data.duration)) {
          updateData.durationSeconds = Math.max(0, Math.round(data.duration));
        }

        let updated = false;
        if (data.passthrough) {
          const result = await prisma.contentItem.updateMany({
            where: { id: data.passthrough },
            data: updateData
          });
          updated = result.count > 0;
        }

        if (!updated) {
          await updateByMuxAssetId(data.id, updateData);
        }

        const contentId = passthrough;
        if (contentId) {
          const content = await prisma.contentItem.findUnique({
            where: { id: contentId },
            select: {
              id: true,
              isPremium: true,
              heroPreviewUrl: true,
              durationSeconds: true,
              muxAssetId: true
            }
          });

          if (
            content &&
            content.isPremium &&
            !content.heroPreviewUrl &&
            content.muxAssetId
          ) {
            const clipEndTime = Math.max(
              1,
              Math.min(
                AUTO_PREVIEW_DURATION_SECONDS,
                content.durationSeconds > 0 ? content.durationSeconds : AUTO_PREVIEW_DURATION_SECONDS
              )
            );

            try {
              await createMuxAssetClip({
                sourceAssetId: content.muxAssetId,
                passthrough: `${PREVIEW_PASSTHROUGH_PREFIX}${content.id}`,
                startTime: 0,
                endTime: clipEndTime
              });
            } catch (err) {
              app.log.error({ contentId: content.id, muxAssetId: content.muxAssetId, err }, "mux.preview_clip_create_failed");
            }
          }
        }
      }

      if (type === "video.asset.errored" && data.id) {
        const errorMessage =
          data.errors?.messages?.join(", ") || "Mux asset processing error";
        const updateData = {
          muxAssetId: data.id,
          videoProvider: "mux",
          videoStatus: "errored",
          videoError: errorMessage
        };

        let updated = false;
        if (data.passthrough) {
          const result = await prisma.contentItem.updateMany({
            where: { id: data.passthrough },
            data: updateData
          });
          updated = result.count > 0;
        }

        if (!updated) {
          await updateByMuxAssetId(data.id, updateData);
        }
      }

      await updateWebhookLog(log.id, {
        status: WebhookEventStatus.PROCESSED,
        httpStatus: 200
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mux webhook processing failed";
      await updateWebhookLog(log.id, {
        status: WebhookEventStatus.FAILED,
        httpStatus: 500,
        errorMessage: message
      });
      throw err;
    }

    return { ok: true };
  });

  app.post(
    "/v1/webhooks/stripe",
    { config: { rawBody: true } },
    async (request, reply) => {
      if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: "Stripe webhook is not configured" });
      }

      const signature = request.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        return reply.status(400).send({ error: "Missing stripe-signature header" });
      }

      const rawBody = (request as unknown as { rawBody?: string }).rawBody;
      if (!rawBody) {
        return reply.status(400).send({ error: "Missing raw webhook body" });
      }

      const stripe = getStripeClient();
      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid Stripe signature";
        await createWebhookLog({
          provider: WebhookProvider.STRIPE,
          eventType: "signature_error",
          externalId: null,
          payload: { error: message }
        }).then((log) =>
          updateWebhookLog(log.id, {
            status: WebhookEventStatus.FAILED,
            httpStatus: 400,
            errorMessage: message
          })
        );
        return reply.status(400).send({ error: message });
      }

      const log = await createWebhookLog({
        provider: WebhookProvider.STRIPE,
        eventType: event.type,
        externalId: event.id,
        payload: event
      });

      app.log.info({ stripeType: event.type, stripeId: event.id }, "Received Stripe webhook");
      try {
        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          if (session.mode === "subscription" && typeof session.subscription === "string") {
            const userId = session.metadata?.userId;
            const planCode = session.metadata?.planCode;
            const couponId = session.metadata?.couponId;
            if (userId && planCode) {
              const subscription = (await stripe.subscriptions.retrieve(session.subscription)) as unknown as Stripe.Subscription;
              await upsertStripeSubscription({
                providerSubscriptionId: subscription.id,
                userId,
                planCode,
                status: subscription.status,
                currentPeriodEndUnix: null,
                canceledAtUnix: subscription.canceled_at ?? null
              });

              if (couponId) {
                const plan = await prisma.plan.findUnique({
                  where: { code: planCode },
                  select: { id: true }
                });
                const existingRedemption = session.id
                  ? await db.couponRedemption.findFirst({
                      where: { stripeCheckoutSessionId: session.id }
                    })
                  : null;
                if (!existingRedemption) {
                  await db.couponRedemption.create({
                    data: {
                      couponId,
                      userId,
                      planId: plan?.id ?? null,
                      stripeCheckoutSessionId: session.id ?? null,
                      stripeSubscriptionId: subscription.id
                    }
                  });
                }
              }
            }
          }

          if (session.mode === "payment" && session.metadata?.purchaseType === "gift_card") {
            const purchaseId = session.metadata?.purchaseId;
            if (purchaseId && app.issueGiftCardFromPurchase) {
              await app.issueGiftCardFromPurchase(purchaseId);
            }
          }
        }

        if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
          const subscription = event.data.object;
          const userId = subscription.metadata?.userId;
          const planCode = subscription.metadata?.planCode;
          if (userId && planCode) {
            await upsertStripeSubscription({
              providerSubscriptionId: subscription.id,
              userId,
              planCode,
              status: subscription.status,
              currentPeriodEndUnix: null,
              canceledAtUnix: subscription.canceled_at ?? null
            });
          }
        }

        if (event.type === "invoice.payment_failed") {
          const invoice = event.data.object;
          const providerSubscriptionId = typeof (invoice as { subscription?: unknown }).subscription === "string"
            ? ((invoice as { subscription?: string }).subscription ?? null)
            : null;
          if (providerSubscriptionId) {
            const existing = await prisma.subscription.findFirst({
              where: { providerSubscriptionId }
            });
            if (existing) {
              await prisma.subscription.update({
                where: { id: existing.id },
                data: { status: SubscriptionStatus.PAST_DUE }
              });
              await sendOpsAlert(
                {
                  service: "flyhigh-api",
                  level: "warn",
                  kind: "payment_failure",
                  message: "Stripe invoice payment failed",
                  metadata: {
                    subscriptionId: providerSubscriptionId,
                    userId: existing.userId,
                    invoiceId: (invoice as { id?: string }).id ?? null
                  }
                },
                app.log
              );
            }
          }
        }

        await updateWebhookLog(log.id, {
          status: WebhookEventStatus.PROCESSED,
          httpStatus: 200
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe webhook processing failed";
        await updateWebhookLog(log.id, {
          status: WebhookEventStatus.FAILED,
          httpStatus: 500,
          errorMessage: message
        });
        throw err;
      }

      return { ok: true };
    }
  );
}
