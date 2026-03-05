import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { GiftCardPurchaseStatus, GiftCardStatus, Role, SubscriptionStatus } from "@prisma/client";
import { badRequest, forbidden, unauthorized } from "../../lib/http.js";
import { env } from "../../lib/env.js";
import { sendMail, isMailerConfigured } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";
import { getStripeClient, isStripeConfigured } from "../../lib/stripe.js";
import { getAuthContext } from "../../lib/viewer.js";

const giftCardCheckoutRateLimit = { keyPrefix: "gift-card-checkout", max: 10, windowMs: 60 * 60 * 1000 };
const giftCardFinalizeRateLimit = { keyPrefix: "gift-card-finalize", max: 20, windowMs: 60 * 60 * 1000 };
const giftCardRedeemRateLimit = { keyPrefix: "gift-card-redeem", max: 10, windowMs: 30 * 60 * 1000 };

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function buildGiftCardCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
    if (i === 3 || i === 7) code += "-";
  }
  return code;
}

async function generateUniqueGiftCardCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = buildGiftCardCode();
    const existing = await prisma.giftCard.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique gift card code");
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

async function sendGiftCardEmail(params: {
  purchase: {
    purchaserName: string;
    recipientEmail: string;
    recipientName: string | null;
    message: string | null;
    product: { name: string; durationMonths: number; plan: { name: string } };
  };
  giftCard: { code: string };
}) {
  if (!isMailerConfigured()) {
    return false;
  }

  const { purchase, giftCard } = params;
  const purchaserName = purchase.purchaserName.trim();
  const redeemBaseUrl = env.STRIPE_GIFT_CARD_SUCCESS_URL.replace(/\/gift-cards.*$/, "");
  const redeemUrl = `${redeemBaseUrl}/redeem?code=${encodeURIComponent(giftCard.code)}`;
  const messageBlock = purchase.message?.trim()
    ? `\n\nMessage from ${purchaserName}:\n${purchase.message.trim()}`
    : "";

  await sendMail({
    to: purchase.recipientEmail,
    subject: `${purchaserName} sent you a FlyHigh TV gift card`,
    text:
      `You received a FlyHigh TV gift card for ${purchase.product.name}.\n\n` +
      `Gift card code: ${giftCard.code}\n` +
      `Redeem at: ${redeemUrl}\n` +
      `Includes: ${purchase.product.durationMonths} month(s) of ${purchase.product.plan.name}.${messageBlock}\n`,
    html:
      `<div style="background:#121212;padding:32px 20px;font-family:Avenir Next,Avenir,Segoe UI,sans-serif;color:#eeeeee">` +
      `<div style="max-width:640px;margin:0 auto;background:#171717;border:1px solid #2b2b2b;border-radius:22px;overflow:hidden">` +
      `<div style="padding:28px 28px 18px;border-bottom:1px solid #2b2b2b">` +
      `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8fc7da;margin-bottom:12px">FlyHigh TV Gift Card</div>` +
      `<h1 style="margin:0 0 10px;font-size:30px;line-height:1.1;color:#ffffff">${purchaserName} sent you access</h1>` +
      `<p style="margin:0;color:#b6b6b6;font-size:16px;line-height:1.5">You received <strong style="color:#ffffff">${purchase.product.name}</strong>, including ${purchase.product.durationMonths} month(s) of ${purchase.product.plan.name}.</p>` +
      `</div>` +
      `<div style="padding:28px">` +
      `<div style="margin-bottom:18px;padding:18px;border-radius:18px;background:#0f0f0f;border:1px solid #2b2b2b">` +
      `<div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#8fc7da;margin-bottom:8px">Gift Card Code</div>` +
      `<div style="font-size:28px;line-height:1.1;font-weight:700;color:#ffffff">${giftCard.code}</div>` +
      `</div>` +
      `<p style="margin:0 0 18px;color:#d8d8d8;font-size:15px;line-height:1.6">Use the button below to redeem this code on a FlyHigh TV account. If you do not have an account yet, you can create one during redemption.</p>` +
      `<p style="margin:0 0 18px"><a href="${redeemUrl}" style="display:inline-block;background:#7dd3fc;border-radius:999px;padding:14px 22px;font-weight:700;color:#ffffff;text-decoration:none">Redeem Gift Card</a></p>` +
      (purchase.message?.trim()
        ? `<div style="margin-top:22px;padding:18px;border-radius:18px;background:#111111;border:1px solid #2b2b2b"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#8fc7da;margin-bottom:8px">Message from ${purchaserName}</div><div style="color:#d8d8d8;font-size:15px;line-height:1.6">${purchase.message.trim()}</div></div>`
        : "") +
      `<p style="margin:22px 0 0;color:#8e8e8e;font-size:13px;line-height:1.5">If the button does not work, open this link: <a href="${redeemUrl}" style="color:#8fc7da">${redeemUrl}</a></p>` +
      `</div></div></div>`
  });

  return true;
}

async function sendGiftCardPurchaserConfirmationEmail(params: {
  purchase: {
    purchaserEmail: string;
    purchaserName: string;
    recipientEmail: string;
    recipientName: string | null;
    product: { name: string; durationMonths: number; plan: { name: string } };
  };
  giftCard: { code: string };
}) {
  if (!isMailerConfigured()) {
    return false;
  }

  const { purchase, giftCard } = params;
  await sendMail({
    to: purchase.purchaserEmail,
    subject: `Your FlyHigh TV gift card for ${purchase.recipientName || purchase.recipientEmail} is ready`,
    text:
      `Your FlyHigh TV gift card purchase is complete.\n\n` +
      `Recipient: ${purchase.recipientName || purchase.recipientEmail}\n` +
      `Product: ${purchase.product.name}\n` +
      `Duration: ${purchase.product.durationMonths} month(s) of ${purchase.product.plan.name}\n` +
      `Gift card code: ${giftCard.code}\n`,
    html:
      `<div style="background:#121212;padding:32px 20px;font-family:Avenir Next,Avenir,Segoe UI,sans-serif;color:#eeeeee">` +
      `<div style="max-width:640px;margin:0 auto;background:#171717;border:1px solid #2b2b2b;border-radius:22px;overflow:hidden">` +
      `<div style="padding:28px">` +
      `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8fc7da;margin-bottom:12px">Gift Card Confirmation</div>` +
      `<h1 style="margin:0 0 10px;font-size:28px;line-height:1.1;color:#ffffff">Gift card sent</h1>` +
      `<p style="margin:0 0 18px;color:#d8d8d8;font-size:15px;line-height:1.6">Your purchase for <strong style="color:#ffffff">${purchase.product.name}</strong> is complete.</p>` +
      `<div style="padding:18px;border-radius:18px;background:#111111;border:1px solid #2b2b2b;color:#d8d8d8;font-size:15px;line-height:1.6">` +
      `<div><strong style="color:#ffffff">Recipient:</strong> ${purchase.recipientName || purchase.recipientEmail}</div>` +
      `<div><strong style="color:#ffffff">Includes:</strong> ${purchase.product.durationMonths} month(s) of ${purchase.product.plan.name}</div>` +
      `<div><strong style="color:#ffffff">Gift card code:</strong> ${giftCard.code}</div>` +
      `</div>` +
      `</div></div></div>`
  });

  return true;
}

async function issueGiftCardFromPurchase(purchaseId: string, app: FastifyInstance) {
  const purchase = await prisma.giftCardPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      product: {
        include: {
          plan: true
        }
      },
      giftCard: true
    }
  });

  if (!purchase) {
    throw new Error("Gift card purchase not found");
  }
  if (purchase.giftCard) {
    return purchase.giftCard;
  }

  const code = await generateUniqueGiftCardCode();
  const giftCard = await prisma.giftCard.create({
    data: {
      code,
      productId: purchase.productId,
      purchaseId: purchase.id,
      expiresAt: addMonths(new Date(), 24)
    }
  });

  await prisma.giftCardPurchase.update({
    where: { id: purchase.id },
    data: {
      status: GiftCardPurchaseStatus.COMPLETED,
      giftCardId: giftCard.id,
      completedAt: new Date()
    }
  });

  if (isMailerConfigured()) {
    await sendGiftCardEmail({ purchase, giftCard });
    await sendGiftCardPurchaserConfirmationEmail({ purchase, giftCard });
  } else {
    app.log.warn({ purchaseId: purchase.id }, "Gift card issued but email service is not configured");
  }

  return giftCard;
}

export async function registerGiftCardRoutes(app: FastifyInstance) {
  app.get("/v1/gift-cards/products", async () => {
    const products = await prisma.giftCardProduct.findMany({
      where: { isActive: true },
      orderBy: [{ amountCents: "asc" }],
      include: {
        plan: {
          select: { code: true, name: true, interval: true }
        }
      }
    });

    return {
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        description: product.description,
        amountUsd: Number((product.amountCents / 100).toFixed(2)),
        amountCents: product.amountCents,
        currency: product.currency,
        durationMonths: product.durationMonths,
        plan: product.plan
      }))
    };
  });

  app.post("/v1/gift-cards/checkout-session", async (request, reply) => {
    if (!enforceRateLimit(giftCardCheckoutRateLimit, request, reply, { message: "Too many gift card checkout attempts. Please try again later." })) {
      return reply;
    }

    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const body = (request.body ?? {}) as {
      productCode?: string;
      purchaserName?: string;
      purchaserEmail?: string;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
    };

    const productCode = body.productCode?.trim() ?? "";
    const purchaserName = body.purchaserName?.trim() ?? "";
    const purchaserEmail = body.purchaserEmail?.trim().toLowerCase() ?? "";
    const recipientName = body.recipientName?.trim() ?? "";
    const recipientEmail = body.recipientEmail?.trim().toLowerCase() ?? "";
    const message = body.message?.trim() ?? "";

    if (!productCode || !purchaserName || !purchaserEmail || !recipientEmail) {
      return badRequest(reply, "productCode, purchaserName, purchaserEmail, and recipientEmail are required");
    }

    const product = await prisma.giftCardProduct.findUnique({
      where: { code: productCode },
      include: { plan: true }
    });
    if (!product || !product.isActive) {
      return reply.status(404).send({ error: "Gift card product not found" });
    }
    if (!product.stripePriceId) {
      return reply.status(400).send({ error: "Gift card product is missing Stripe price id" });
    }

    const purchase = await prisma.giftCardPurchase.create({
      data: {
        productId: product.id,
        purchaserName,
        purchaserEmail,
        recipientName: recipientName || null,
        recipientEmail,
        message: message || null,
        status: GiftCardPurchaseStatus.PENDING
      }
    });

    const stripe = getStripeClient();
    const successUrl = `${env.STRIPE_GIFT_CARD_SUCCESS_URL}${env.STRIPE_GIFT_CARD_SUCCESS_URL.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: purchaserEmail,
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: env.STRIPE_GIFT_CARD_CANCEL_URL,
      metadata: {
        purchaseType: "gift_card",
        purchaseId: purchase.id,
        productCode: product.code
      }
    });

    await prisma.giftCardPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id }
    });

    return {
      checkoutUrl: session.url,
      purchaseId: purchase.id
    };
  });

  app.post("/v1/gift-cards/finalize-checkout", async (request, reply) => {
    if (!enforceRateLimit(giftCardFinalizeRateLimit, request, reply, { message: "Too many gift card finalize attempts. Please try again later." })) {
      return reply;
    }

    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const body = (request.body ?? {}) as { sessionId?: string };
    const sessionId = body.sessionId?.trim() ?? "";
    if (!sessionId) {
      return badRequest(reply, "sessionId is required");
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "payment" || session.metadata?.purchaseType !== "gift_card") {
      return reply.status(400).send({ error: "Checkout session is not a gift card purchase" });
    }
    if (session.payment_status !== "paid") {
      return reply.status(400).send({ error: "Checkout session is not paid yet" });
    }

    const purchaseId = session.metadata?.purchaseId;
    if (!purchaseId) {
      return reply.status(400).send({ error: "Checkout session is missing purchase id" });
    }

    const giftCard = await issueGiftCardFromPurchase(purchaseId, app);
    return {
      ok: true,
      code: giftCard.code
    };
  });

  app.post("/v1/gift-cards/redeem", async (request, reply) => {
    if (!enforceRateLimit(giftCardRedeemRateLimit, request, reply, { message: "Too many gift card redemption attempts. Please wait and try again." })) {
      return reply;
    }

    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required before redeeming a gift card");
    }

    const body = (request.body ?? {}) as { code?: string };
    const rawCode = body.code?.trim().toUpperCase() ?? "";
    if (!rawCode) {
      return badRequest(reply, "code is required");
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: rawCode },
      include: {
        product: {
          include: { plan: true }
        }
      }
    });

    if (!giftCard) {
      return reply.status(404).send({ error: "Gift card not found" });
    }
    if (giftCard.status !== GiftCardStatus.AVAILABLE) {
      return reply.status(400).send({ error: "Gift card is not available to redeem" });
    }
    if (giftCard.expiresAt && giftCard.expiresAt.getTime() <= Date.now()) {
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: GiftCardStatus.EXPIRED }
      });
      return reply.status(400).send({ error: "Gift card has expired" });
    }

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: auth.user.id,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
      },
      orderBy: [{ updatedAt: "desc" }]
    });
    const now = new Date();
    const startFrom =
      activeSubscription?.currentPeriodEnd && activeSubscription.currentPeriodEnd.getTime() > now.getTime()
        ? activeSubscription.currentPeriodEnd
        : now;
    const currentPeriodEnd = addMonths(startFrom, giftCard.product.durationMonths);
    const existingGiftEntitlement = await prisma.subscription.findFirst({
      where: {
        userId: auth.user.id,
        provider: "gift_card",
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }
      },
      orderBy: [{ currentPeriodEnd: "desc" }, { updatedAt: "desc" }]
    });

    await prisma.$transaction(async (tx) => {
      if (existingGiftEntitlement) {
        await tx.subscription.update({
          where: { id: existingGiftEntitlement.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            planId: giftCard.product.planId,
            currentPeriodEnd
          }
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: auth.user.id,
            planId: giftCard.product.planId,
            status: SubscriptionStatus.ACTIVE,
            provider: "gift_card",
            currentPeriodEnd
          }
        });
      }

      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: GiftCardStatus.REDEEMED,
          redeemedByUserId: auth.user.id,
          redeemedAt: now
        }
      });
    });

    return {
      ok: true,
      code: giftCard.code,
      planName: giftCard.product.plan.name,
      durationMonths: giftCard.product.durationMonths,
      currentPeriodEnd: currentPeriodEnd.toISOString()
    };
  });

  app.get("/v1/admin/gift-card-products", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const products = await prisma.giftCardProduct.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        plan: { select: { id: true, code: true, name: true } },
        _count: { select: { purchases: true, giftCards: true } }
      }
    });

    return {
      products: products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        description: product.description,
        amountCents: product.amountCents,
        amountUsd: Number((product.amountCents / 100).toFixed(2)),
        currency: product.currency,
        durationMonths: product.durationMonths,
        stripePriceId: product.stripePriceId,
        plan: product.plan,
        isActive: product.isActive,
        purchaseCount: product._count.purchases,
        issuedCount: product._count.giftCards,
        createdAt: product.createdAt.toISOString()
      }))
    };
  });

  app.post("/v1/admin/gift-card-products", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const body = (request.body ?? {}) as {
      code?: string;
      name?: string;
      description?: string;
      amountCents?: number;
      currency?: string;
      durationMonths?: number;
      stripePriceId?: string;
      planCode?: string;
      isActive?: boolean;
    };

    const code = body.code?.trim().toUpperCase() ?? "";
    const name = body.name?.trim() ?? "";
    const planCode = body.planCode?.trim() ?? "";
    const stripePriceId = body.stripePriceId?.trim() ?? "";

    if (!code || !name || !planCode || !stripePriceId) {
      return badRequest(reply, "code, name, planCode, and stripePriceId are required");
    }

    const amountCents = Number(body.amountCents ?? 0);
    const durationMonths = Number(body.durationMonths ?? 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return badRequest(reply, "amountCents must be greater than 0");
    }
    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      return badRequest(reply, "durationMonths must be greater than 0");
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const created = await prisma.giftCardProduct.create({
      data: {
        code,
        name,
        description: body.description?.trim() || null,
        amountCents: Math.round(amountCents),
        currency: (body.currency?.trim() || "USD").toUpperCase(),
        durationMonths: Math.round(durationMonths),
        stripePriceId,
        planId: plan.id,
        isActive: body.isActive ?? true
      }
    });

    return reply.status(201).send({
      id: created.id,
      code: created.code
    });
  });

  app.patch("/v1/admin/gift-card-products/:id", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      code?: string;
      name?: string;
      description?: string | null;
      amountCents?: number;
      currency?: string;
      durationMonths?: number;
      stripePriceId?: string | null;
      planCode?: string;
      isActive?: boolean;
    };

    const existing = await prisma.giftCardProduct.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Gift card product not found" });
    }

    let planId: string | undefined;
    if (typeof body.planCode === "string" && body.planCode.trim()) {
      const plan = await prisma.plan.findUnique({ where: { code: body.planCode.trim() } });
      if (!plan) {
        return reply.status(404).send({ error: "Plan not found" });
      }
      planId = plan.id;
    }

    const updated = await prisma.giftCardProduct.update({
      where: { id },
      data: {
        code: typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : undefined,
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
        description: body.description === null ? null : typeof body.description === "string" ? body.description.trim() || null : undefined,
        amountCents: typeof body.amountCents === "number" ? Math.max(1, Math.round(body.amountCents)) : undefined,
        currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : undefined,
        durationMonths: typeof body.durationMonths === "number" ? Math.max(1, Math.round(body.durationMonths)) : undefined,
        stripePriceId: body.stripePriceId === null ? null : typeof body.stripePriceId === "string" ? body.stripePriceId.trim() || null : undefined,
        planId,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined
      }
    });

    return {
      id: updated.id,
      isActive: updated.isActive
    };
  });

  app.get("/v1/admin/gift-cards", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const cards = await prisma.giftCard.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        product: { select: { name: true, durationMonths: true } },
        purchase: {
          select: {
            purchaserName: true,
            purchaserEmail: true,
            recipientName: true,
            recipientEmail: true
          }
        },
        redeemedByUser: {
          select: { email: true, displayName: true }
        }
      }
    });

    return {
      giftCards: cards.map((card) => ({
        id: card.id,
        code: card.code,
        status: card.status.toLowerCase(),
        productName: card.product.name,
        durationMonths: card.product.durationMonths,
        purchaserName: card.purchase.purchaserName,
        purchaserEmail: card.purchase.purchaserEmail,
        recipientName: card.purchase.recipientName,
        recipientEmail: card.purchase.recipientEmail,
        redeemedBy:
          card.redeemedByUser?.displayName || card.redeemedByUser?.email || null,
        redeemedAt: card.redeemedAt?.toISOString() ?? null,
        createdAt: card.createdAt.toISOString()
      }))
    };
  });

  app.get("/v1/admin/gift-cards/analytics", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const [purchaseCount, completedPurchaseCount, issuedCount, redeemedCount, byProductRows, recentPurchases] = await Promise.all([
      prisma.giftCardPurchase.count(),
      prisma.giftCardPurchase.count({ where: { status: GiftCardPurchaseStatus.COMPLETED } }),
      prisma.giftCard.count(),
      prisma.giftCard.count({ where: { status: GiftCardStatus.REDEEMED } }),
      prisma.giftCardProduct.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: {
          _count: { select: { purchases: true, giftCards: true } },
          purchases: {
            where: { status: GiftCardPurchaseStatus.COMPLETED },
            select: { id: true }
          }
        }
      }),
      prisma.giftCardPurchase.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        include: {
          product: { select: { name: true, amountCents: true } },
          giftCard: { select: { code: true, status: true, redeemedAt: true } }
        }
      })
    ]);

    const revenueCents = byProductRows.reduce(
      (sum, row) => sum + row.amountCents * row.purchases.length,
      0
    );

    return {
      totals: {
        purchaseCount,
        completedPurchaseCount,
        issuedCount,
        redeemedCount,
        revenueUsd: Number((revenueCents / 100).toFixed(2))
      },
      byProduct: byProductRows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        amountUsd: Number((row.amountCents / 100).toFixed(2)),
        durationMonths: row.durationMonths,
        purchaseCount: row._count.purchases,
        issuedCount: row._count.giftCards,
        revenueUsd: Number(((row.amountCents * row.purchases.length) / 100).toFixed(2))
      })),
      recentPurchases: recentPurchases.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        purchaserName: row.purchaserName,
        recipientEmail: row.recipientEmail,
        productName: row.product.name,
        amountUsd: Number((row.product.amountCents / 100).toFixed(2)),
        status: row.status.toLowerCase(),
        code: row.giftCard?.code ?? null,
        redeemedAt: row.giftCard?.redeemedAt?.toISOString() ?? null
      }))
    };
  });

  app.post("/v1/admin/gift-cards/:id/resend", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      include: {
        purchase: true,
        product: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!giftCard) {
      return reply.status(404).send({ error: "Gift card not found" });
    }
    if (!isMailerConfigured()) {
      return reply.status(503).send({ error: "Email service is not configured" });
    }

    await sendGiftCardEmail({
      giftCard,
      purchase: {
        purchaserName: giftCard.purchase.purchaserName,
        recipientEmail: giftCard.purchase.recipientEmail,
        recipientName: giftCard.purchase.recipientName,
        message: giftCard.purchase.message,
        product: {
          name: giftCard.product.name,
          durationMonths: giftCard.product.durationMonths,
          plan: { name: giftCard.product.plan.name }
        }
      }
    });

    return { ok: true };
  });

  app.post("/v1/admin/gift-cards/:id/void", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const giftCard = await prisma.giftCard.findUnique({ where: { id } });
    if (!giftCard) {
      return reply.status(404).send({ error: "Gift card not found" });
    }
    if (giftCard.status === GiftCardStatus.REDEEMED) {
      return reply.status(400).send({ error: "Redeemed gift cards cannot be voided" });
    }
    if (giftCard.status === GiftCardStatus.VOID) {
      return { ok: true };
    }

    await prisma.$transaction([
      prisma.giftCard.update({
        where: { id },
        data: { status: GiftCardStatus.VOID }
      }),
      prisma.giftCardPurchase.update({
        where: { id: giftCard.purchaseId },
        data: { status: GiftCardPurchaseStatus.CANCELED }
      })
    ]);

    return { ok: true };
  });

  app.post("/v1/internal/gift-cards/issue-from-purchase", async (request, reply) => {
    const body = (request.body ?? {}) as { purchaseId?: string };
    if (!body.purchaseId) {
      return badRequest(reply, "purchaseId is required");
    }
    const giftCard = await issueGiftCardFromPurchase(body.purchaseId, app);
    return { id: giftCard.id, code: giftCard.code };
  });

  app.decorate("issueGiftCardFromPurchase", async (purchaseId: string) => issueGiftCardFromPurchase(purchaseId, app));
}

declare module "fastify" {
  interface FastifyInstance {
    issueGiftCardFromPurchase?: (purchaseId: string) => Promise<{ id: string; code: string } | any>;
  }
}
