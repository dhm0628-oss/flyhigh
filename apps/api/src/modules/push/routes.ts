import type { FastifyInstance } from "fastify";
import { Role, SubscriptionStatus } from "@prisma/client";
import { badRequest, forbidden, unauthorized } from "../../lib/http.js";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import { getAuthContext } from "../../lib/viewer.js";

type PushAudience = "all" | "subscribers" | "inactive" | "users";

function parsePlatform(value?: string): "WEB" | "ROKU" | "FIRE_TV" | "IOS" | "ANDROID" | "OTHER" {
  const normalized = (value ?? "OTHER").trim().toUpperCase();
  if (["WEB", "ROKU", "FIRE_TV", "IOS", "ANDROID"].includes(normalized)) {
    return normalized as "WEB" | "ROKU" | "FIRE_TV" | "IOS" | "ANDROID";
  }
  return "OTHER";
}

async function requireAdmin(request: any, reply: any) {
  const auth = await getAuthContext(request);
  if (!auth) {
    unauthorized(reply);
    return null;
  }
  if (auth.user.role !== Role.ADMIN) {
    forbidden(reply);
    return null;
  }
  return auth;
}

async function sendOneSignalByTokens(params: {
  appId: string;
  apiKey: string;
  tokens: string[];
  title: string;
  message: string;
  deeplinkUrl?: string | null;
}) {
  const chunkSize = 2000;
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < params.tokens.length; i += chunkSize) {
    const batch = params.tokens.slice(i, i + chunkSize);
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        Authorization: `Basic ${params.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: params.appId,
        include_subscription_ids: batch,
        headings: { en: params.title },
        contents: { en: params.message },
        url: params.deeplinkUrl || undefined
      })
    });

    if (!response.ok) {
      failedCount += batch.length;
      continue;
    }
    sentCount += batch.length;
  }

  return { sentCount, failedCount };
}

export async function registerPushRoutes(app: FastifyInstance) {
  const db = prisma as any;

  app.post("/v1/push/register", async (request, reply) => {
    const auth = await getAuthContext(request);
    const body = (request.body ?? {}) as {
      token?: string;
      platform?: string;
      provider?: string;
      deviceName?: string;
    };

    const token = body.token?.trim();
    if (!token) {
      return badRequest(reply, "token is required");
    }

    const platform = parsePlatform(body.platform);
    const provider = (body.provider ?? "ONESIGNAL").trim().toUpperCase();
    if (provider !== "ONESIGNAL") {
      return badRequest(reply, "Only ONESIGNAL provider is supported right now");
    }

    await db.pushDevice.upsert({
      where: { token },
      update: {
        userId: auth?.user.id ?? null,
        platform,
        provider,
        deviceName: body.deviceName?.trim() || null,
        isActive: true,
        lastSeenAt: new Date()
      },
      create: {
        token,
        userId: auth?.user.id ?? null,
        platform,
        provider,
        deviceName: body.deviceName?.trim() || null,
        isActive: true,
        lastSeenAt: new Date()
      }
    });

    return { ok: true };
  });

  app.post("/v1/push/unregister", async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string };
    const token = body.token?.trim();
    if (!token) return badRequest(reply, "token is required");

    await db.pushDevice.updateMany({
      where: { token },
      data: { isActive: false }
    });
    return { ok: true };
  });

  app.get("/v1/admin/marketing/push/devices", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const query = (request.query ?? {}) as { platform?: string; active?: string; limit?: string | number };
    const limitRaw = Number(query.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;
    const platform = query.platform ? parsePlatform(query.platform) : null;
    const active = query.active === "false" ? false : query.active === "true" ? true : null;

    const devices = await db.pushDevice.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(active === null ? {} : { isActive: active })
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      include: {
        user: { select: { id: true, email: true, displayName: true } }
      }
    });

    return {
      devices: devices.map((d: any) => ({
        id: d.id,
        platform: d.platform.toLowerCase(),
        provider: d.provider.toLowerCase(),
        tokenLast4: d.token.slice(-4),
        isActive: d.isActive,
        deviceName: d.deviceName ?? "",
        lastSeenAt: d.lastSeenAt.toISOString(),
        user: d.user
      }))
    };
  });

  app.get("/v1/admin/marketing/push/campaigns", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const campaigns = await db.pushCampaign.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 50
    });

    return {
      campaigns: campaigns.map((c: any) => ({
        id: c.id,
        title: c.title,
        message: c.message,
        target: c.target,
        deeplinkUrl: c.deeplinkUrl,
        status: c.status.toLowerCase(),
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        createdAt: c.createdAt.toISOString(),
        sentAt: c.sentAt?.toISOString() ?? null
      }))
    };
  });

  app.post("/v1/admin/marketing/push/send", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const body = (request.body ?? {}) as {
      title?: string;
      message?: string;
      deeplinkUrl?: string;
      audience?: PushAudience;
      userIds?: string[];
      platform?: string;
    };

    const title = body.title?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    if (!title || !message) {
      return badRequest(reply, "title and message are required");
    }

    const audience = (body.audience ?? "subscribers") as PushAudience;
    if (!["all", "subscribers", "inactive", "users"].includes(audience)) {
      return badRequest(reply, "Invalid audience");
    }

    const platform = body.platform ? parsePlatform(body.platform) : null;
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id) => typeof id === "string" && id.trim()) : [];

    const deviceWhereBase: any = {
      isActive: true,
      provider: "ONESIGNAL",
      ...(platform ? { platform } : {})
    };

    let userFilter: any = undefined;
    if (audience === "users") {
      if (!userIds.length) {
        return badRequest(reply, "userIds is required for users audience");
      }
      userFilter = { id: { in: userIds } };
    } else if (audience === "subscribers") {
      userFilter = {
        subscriptions: {
          some: {
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
          }
        }
      };
    } else if (audience === "inactive") {
      userFilter = {
        OR: [
          { subscriptions: { none: {} } },
          {
            subscriptions: {
              every: {
                status: { in: [SubscriptionStatus.INACTIVE, SubscriptionStatus.CANCELED, SubscriptionStatus.PAST_DUE] }
              }
            }
          }
        ]
      };
    }

    const devices = await db.pushDevice.findMany({
      where: {
        ...deviceWhereBase,
        ...(audience === "all"
          ? {}
          : {
              user: userFilter
            })
      },
      select: { token: true }
    });
    const tokens: string[] = Array.from(
      new Set<string>(
        devices
          .map((d: any) => d.token)
          .filter((token: unknown): token is string => typeof token === "string" && token.length > 0)
      )
    );

    const campaign = await db.pushCampaign.create({
      data: {
        title,
        message,
        target: audience,
        deeplinkUrl: body.deeplinkUrl?.trim() || null,
        provider: "ONESIGNAL",
        status: "QUEUED",
        requestedById: auth.user.id,
        metadataJson: JSON.stringify({
          audience,
          platform: platform ?? "all",
          intendedDevices: tokens.length
        })
      }
    });

    if (!tokens.length) {
      await db.pushCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED", failedCount: 0, sentAt: new Date() }
      });
      return {
        ok: false,
        error: "No registered push devices match this audience",
        campaignId: campaign.id
      };
    }

    if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_API_KEY) {
      return {
        ok: true,
        queued: true,
        campaignId: campaign.id,
        matchedDevices: tokens.length,
        note: "Push provider keys missing. Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY to send live notifications."
      };
    }

    const sent = await sendOneSignalByTokens({
      appId: env.ONESIGNAL_APP_ID,
      apiKey: env.ONESIGNAL_API_KEY,
      tokens,
      title,
      message,
      deeplinkUrl: body.deeplinkUrl?.trim() || null
    });

    await db.pushCampaign.update({
      where: { id: campaign.id },
      data: {
        status: sent.sentCount > 0 ? "SENT" : "FAILED",
        sentCount: sent.sentCount,
        failedCount: sent.failedCount,
        sentAt: new Date()
      }
    });

    return {
      ok: sent.sentCount > 0,
      campaignId: campaign.id,
      matchedDevices: tokens.length,
      sentCount: sent.sentCount,
      failedCount: sent.failedCount
    };
  });
}
