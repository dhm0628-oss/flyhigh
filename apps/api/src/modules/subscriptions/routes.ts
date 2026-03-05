import type { FastifyInstance } from "fastify";
import { PublishStatus, Role, SubscriptionStatus } from "@prisma/client";
import { badRequest, forbidden, unauthorized } from "../../lib/http.js";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";
import { getStripeClient, isStripeConfigured } from "../../lib/stripe.js";
import { upsertStripeSubscription } from "../../lib/subscriptions.js";
import { getAuthContext } from "../../lib/viewer.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const subscriptionFinalizeRateLimit = { keyPrefix: "subscription-finalize", max: 20, windowMs: 60 * 60 * 1000 };

function parseDateInput(value?: string | number): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function weekStartUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
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

async function recordCouponRedemptionIfNeeded(params: {
  couponId: string;
  userId: string;
  planCode: string;
  stripeCheckoutSessionId: string | null;
  stripeSubscriptionId: string;
}) {
  const db = prisma as any;
  const existingRedemption = params.stripeCheckoutSessionId
    ? await db.couponRedemption.findFirst({
        where: { stripeCheckoutSessionId: params.stripeCheckoutSessionId }
      })
    : null;

  if (existingRedemption) {
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { code: params.planCode },
    select: { id: true }
  });

  await db.couponRedemption.create({
    data: {
      couponId: params.couponId,
      userId: params.userId,
      planId: plan?.id ?? null,
      stripeCheckoutSessionId: params.stripeCheckoutSessionId,
      stripeSubscriptionId: params.stripeSubscriptionId
    }
  });
}

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  const db = prisma as any;
  app.get("/v1/subscriptions/plans", async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ priceCents: "asc" }]
    });

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        interval: plan.interval,
        priceUsd: Number((plan.priceCents / 100).toFixed(2)),
        currency: plan.currency
      }))
    };
  });

  app.post("/v1/subscriptions/checkout-session", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required before starting checkout");
    }

    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const body = (request.body ?? {}) as { planCode?: string; couponCode?: string };
    if (!body.planCode) {
      return badRequest(reply, "planCode is required");
    }

    const plan = await prisma.plan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.isActive) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const fallbackPriceId =
      plan.code === "monthly"
        ? env.STRIPE_PRICE_MONTHLY
        : plan.code === "yearly"
          ? env.STRIPE_PRICE_YEARLY
          : "";
    const priceId = plan.providerPriceId ?? fallbackPriceId;
    if (!priceId) {
      return reply.status(400).send({ error: `Stripe price id missing for plan '${plan.code}'` });
    }

    let coupon: {
      id: string;
      code: string;
      kind: "PERCENT_OFF" | "AMOUNT_OFF" | "FREE_TRIAL";
      stripePromotionCodeId: string | null;
      trialDays: number | null;
    } | null = null;

    if (typeof body.couponCode === "string" && body.couponCode.trim()) {
      const couponCode = body.couponCode.trim().toUpperCase();
      const found = await db.coupon.findUnique({
        where: { code: couponCode },
        select: {
          id: true,
          code: true,
          kind: true,
          isActive: true,
          expiresAt: true,
          maxRedemptions: true,
          stripePromotionCodeId: true,
          trialDays: true
        }
      });

      if (!found || !found.isActive) {
        return reply.status(404).send({ error: "Coupon code not found" });
      }
      if (found.expiresAt && found.expiresAt.getTime() <= Date.now()) {
        return reply.status(400).send({ error: "Coupon code has expired" });
      }
      if (typeof found.maxRedemptions === "number") {
        const used = await db.couponRedemption.count({
          where: { couponId: found.id }
        });
        if (used >= found.maxRedemptions) {
          return reply.status(400).send({ error: "Coupon code redemption limit reached" });
        }
      }
      if (
        (found.kind === "PERCENT_OFF" || found.kind === "AMOUNT_OFF") &&
        !found.stripePromotionCodeId
      ) {
        return reply.status(400).send({ error: "Coupon is missing Stripe promotion code mapping" });
      }
      if (found.kind === "FREE_TRIAL" && !found.trialDays) {
        return reply.status(400).send({ error: "Coupon trial days are not configured" });
      }

      coupon = {
        id: found.id,
        code: found.code,
        kind: found.kind,
        stripePromotionCodeId: found.stripePromotionCodeId ?? null,
        trialDays: found.trialDays ?? null
      };
    }

    const stripe = getStripeClient();
    const successUrl = `${env.STRIPE_SUCCESS_URL}${env.STRIPE_SUCCESS_URL.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: auth.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: env.STRIPE_CANCEL_URL,
      allow_promotion_codes: true,
      discounts:
        coupon && (coupon.kind === "PERCENT_OFF" || coupon.kind === "AMOUNT_OFF")
          ? [{ promotion_code: coupon.stripePromotionCodeId! }]
          : undefined,
      metadata: {
        userId: auth.user.id,
        planCode: plan.code,
        couponId: coupon?.id ?? "",
        couponCode: coupon?.code ?? ""
      },
      subscription_data: {
        trial_period_days: coupon?.kind === "FREE_TRIAL" ? coupon.trialDays! : undefined,
        metadata: {
          userId: auth.user.id,
          planCode: plan.code,
          couponId: coupon?.id ?? "",
          couponCode: coupon?.code ?? ""
        }
      }
    });

    return {
      provider: "stripe",
      planCode: plan.code,
      couponCode: coupon?.code ?? null,
      checkoutUrl: session.url
    };
  });

  app.post("/v1/subscriptions/finalize-checkout", async (request, reply) => {
    if (!enforceRateLimit(subscriptionFinalizeRateLimit, request, reply, { message: "Too many subscription finalize attempts. Please try again later." })) {
      return reply;
    }

    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required before finalizing checkout");
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
    if (session.mode !== "subscription") {
      return reply.status(400).send({ error: "Checkout session is not a subscription checkout" });
    }
    if (session.status !== "complete" || typeof session.subscription !== "string") {
      return reply.status(400).send({ error: "Checkout session is not complete yet" });
    }

    const userId = session.metadata?.userId;
    const planCode = session.metadata?.planCode;
    const couponId = session.metadata?.couponId;
    if (!userId || !planCode) {
      return reply.status(400).send({ error: "Checkout session is missing subscription metadata" });
    }
    if (userId !== auth.user.id) {
      return reply.status(403).send({ error: "Checkout session does not belong to this account" });
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await upsertStripeSubscription({
      providerSubscriptionId: subscription.id,
      userId,
      planCode,
      status: subscription.status,
      currentPeriodEndUnix: null,
      canceledAtUnix: subscription.canceled_at ?? null
    });

    if (couponId) {
      await recordCouponRedemptionIfNeeded({
        couponId,
        userId,
        planCode,
        stripeCheckoutSessionId: session.id ?? null,
        stripeSubscriptionId: subscription.id
      });
    }

    const updated = await prisma.subscription.findFirst({
      where: {
        userId,
        provider: "stripe",
        providerSubscriptionId: subscription.id
      },
      orderBy: [{ updatedAt: "desc" }],
      include: { plan: true }
    });

    return {
      ok: true,
      subscriptionStatus: updated?.status?.toLowerCase() ?? "inactive",
      planCode: updated?.plan.code ?? planCode
    };
  });

  app.post("/v1/subscriptions/billing-portal-session", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required");
    }
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const stripe = getStripeClient();

    const latestStripeSub = await prisma.subscription.findFirst({
      where: {
        userId: auth.user.id,
        provider: "stripe",
        providerSubscriptionId: { not: null }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    let customerId: string | null = null;

    if (latestStripeSub?.providerSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(latestStripeSub.providerSubscriptionId);
        customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const existing = await stripe.customers.list({
        email: auth.user.email,
        limit: 1
      });
      if (existing.data[0]) {
        customerId = existing.data[0].id;
      } else {
        const created = await stripe.customers.create({
          email: auth.user.email,
          name: auth.user.displayName,
          metadata: { userId: auth.user.id }
        });
        customerId = created.id;
      }
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: env.STRIPE_BILLING_PORTAL_RETURN_URL
    });

    return {
      url: portalSession.url
    };
  });

  app.post("/v1/subscriptions/cancel", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required");
    }
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const latestStripeSub = await prisma.subscription.findFirst({
      where: {
        userId: auth.user.id,
        provider: "stripe",
        providerSubscriptionId: { not: null }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    if (!latestStripeSub?.providerSubscriptionId) {
      return reply.status(404).send({ error: "No Stripe subscription found for this account" });
    }

    const stripe = getStripeClient();
    const updated = await stripe.subscriptions.update(latestStripeSub.providerSubscriptionId, {
      cancel_at_period_end: true
    });

    return {
      ok: true,
      subscriptionId: updated.id,
      cancelAtPeriodEnd: updated.cancel_at_period_end
    };
  });

  app.post("/v1/subscriptions/resume", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required");
    }
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const latestStripeSub = await prisma.subscription.findFirst({
      where: {
        userId: auth.user.id,
        provider: "stripe",
        providerSubscriptionId: { not: null }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    if (!latestStripeSub?.providerSubscriptionId) {
      return reply.status(404).send({ error: "No Stripe subscription found for this account" });
    }

    const stripe = getStripeClient();
    const updated = await stripe.subscriptions.update(latestStripeSub.providerSubscriptionId, {
      cancel_at_period_end: false
    });

    return {
      ok: true,
      subscriptionId: updated.id,
      cancelAtPeriodEnd: updated.cancel_at_period_end
    };
  });

  app.get("/v1/subscriptions/me", async (request, reply) => {
    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply, "Sign in required");
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: { plan: true }
    });

    const latest =
      subscriptions.find((row) => row.status === SubscriptionStatus.ACTIVE || row.status === SubscriptionStatus.TRIALING) ??
      subscriptions[0];

    if (!latest) {
      return {
        hasSubscription: false,
        subscription: null,
        invoices: [],
        giftCardEntitlements: []
      };
    }

    const response: {
      hasSubscription: boolean;
      subscription: {
        id: string;
        status: string;
        provider: string;
        planCode: string;
        planName: string;
        interval: string;
        priceUsd: number;
        currency: string;
        currentPeriodEnd: string | null;
        canceledAt: string | null;
        cancelAtPeriodEnd: boolean;
        cancelAt: string | null;
        updatedAt: string;
      };
      invoices: Array<{
        id: string;
        createdAt: string;
        status: string;
        amountPaidUsd: number;
        amountDueUsd: number;
        currency: string;
        hostedInvoiceUrl: string | null;
        invoicePdf: string | null;
      }>;
      giftCardEntitlements: Array<{
        id: string;
        planName: string;
        status: string;
        currentPeriodEnd: string | null;
        updatedAt: string;
      }>;
    } = {
      hasSubscription: true,
      subscription: {
        id: latest.id,
        status: latest.status.toLowerCase(),
        provider: latest.provider,
        planCode: latest.plan.code,
        planName: latest.plan.name,
        interval: latest.plan.interval,
        priceUsd: Number((latest.plan.priceCents / 100).toFixed(2)),
        currency: latest.plan.currency,
        currentPeriodEnd: latest.currentPeriodEnd?.toISOString() ?? null,
        canceledAt: latest.canceledAt?.toISOString() ?? null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        updatedAt: latest.updatedAt.toISOString()
      },
      invoices: [],
      giftCardEntitlements: subscriptions
        .filter((row) => row.provider === "gift_card")
        .map((row) => ({
          id: row.id,
          planName: row.plan.name,
          status: row.status.toLowerCase(),
          currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString()
        }))
    };

    if (latest.provider === "stripe" && latest.providerSubscriptionId && isStripeConfigured()) {
      try {
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(latest.providerSubscriptionId);
        response.subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
        response.subscription.cancelAt =
          typeof stripeSubscription.cancel_at === "number"
            ? new Date(stripeSubscription.cancel_at * 1000).toISOString()
            : null;

        const customerId =
          typeof stripeSubscription.customer === "string"
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id ?? null;

        if (customerId) {
          const invoices = await stripe.invoices.list({ customer: customerId, limit: 12 });
          response.invoices = invoices.data.map((invoice) => ({
            id: invoice.id ?? `inv_${invoice.created}`,
            createdAt: new Date(invoice.created * 1000).toISOString(),
            status: invoice.status ?? "unknown",
            amountPaidUsd: Number(((invoice.amount_paid ?? 0) / 100).toFixed(2)),
            amountDueUsd: Number(((invoice.amount_due ?? 0) / 100).toFixed(2)),
            currency: (invoice.currency ?? "usd").toUpperCase(),
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdf: invoice.invoice_pdf ?? null
          }));
        }
      } catch (error) {
        app.log.warn({ err: error }, "Failed to enrich subscription details from Stripe");
      }
    }

    return response;
  });

  app.get("/v1/admin/subscribers", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const subscribers = await prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          include: { plan: true }
        }
      }
    });

    return {
      subscribers: subscribers.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role.toLowerCase(),
        latestSubscription: user.subscriptions[0]
          ? {
              status: user.subscriptions[0].status.toLowerCase(),
              planName: user.subscriptions[0].plan.name,
              currentPeriodEnd: user.subscriptions[0].currentPeriodEnd?.toISOString() ?? null
            }
          : null
      }))
    };
  });

  app.get("/v1/admin/plans", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const plans = await prisma.plan.findMany({
      orderBy: [{ createdAt: "asc" }]
    });

    return {
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        interval: plan.interval,
        priceCents: plan.priceCents,
        priceUsd: Number((plan.priceCents / 100).toFixed(2)),
        currency: plan.currency,
        provider: plan.provider,
        providerPriceId: plan.providerPriceId,
        isActive: plan.isActive,
        updatedAt: plan.updatedAt.toISOString()
      }))
    };
  });

  app.get("/v1/admin/coupons", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const coupons = await db.coupon.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: { select: { redemptions: true } }
      }
    });

    return {
      coupons: coupons.map((coupon: any) => ({
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        kind: coupon.kind.toLowerCase(),
        duration: coupon.duration.toLowerCase(),
        percentOff: coupon.percentOff,
        amountOffCents: coupon.amountOffCents,
        trialDays: coupon.trialDays,
        durationInMonths: coupon.durationInMonths,
        maxRedemptions: coupon.maxRedemptions,
        expiresAt: coupon.expiresAt?.toISOString() ?? null,
        isActive: coupon.isActive,
        stripeCouponId: coupon.stripeCouponId,
        stripePromotionCodeId: coupon.stripePromotionCodeId,
        redemptionCount: coupon._count.redemptions,
        createdAt: coupon.createdAt.toISOString(),
        updatedAt: coupon.updatedAt.toISOString()
      }))
    };
  });

  app.post("/v1/admin/coupons", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }
    if (!isStripeConfigured()) {
      return reply.status(503).send({ error: "Stripe is not configured on the server" });
    }

    const body = (request.body ?? {}) as {
      code?: string;
      name?: string;
      kind?: "percent_off" | "amount_off" | "free_trial";
      duration?: "once" | "repeating" | "forever";
      percentOff?: number;
      amountOffCents?: number;
      trialDays?: number;
      durationInMonths?: number;
      maxRedemptions?: number;
      expiresAt?: string | null;
      isActive?: boolean;
    };

    const code = body.code?.trim().toUpperCase() ?? "";
    const name = body.name?.trim() ?? "";
    const kindRaw = (body.kind ?? "").toLowerCase();
    const durationRaw = (body.duration ?? "once").toLowerCase();
    if (!code || !name) {
      return badRequest(reply, "code and name are required");
    }
    if (!["percent_off", "amount_off", "free_trial"].includes(kindRaw)) {
      return badRequest(reply, "kind must be percent_off, amount_off, or free_trial");
    }
    if (!["once", "repeating", "forever"].includes(durationRaw)) {
      return badRequest(reply, "duration must be once, repeating, or forever");
    }

    const kind =
      kindRaw === "percent_off"
        ? "PERCENT_OFF"
        : kindRaw === "amount_off"
          ? "AMOUNT_OFF"
          : "FREE_TRIAL";
    const duration =
      durationRaw === "repeating"
        ? "REPEATING"
        : durationRaw === "forever"
          ? "FOREVER"
          : "ONCE";

    let percentOff: number | null = null;
    let amountOffCents: number | null = null;
    let trialDays: number | null = null;
    if (kind === "PERCENT_OFF") {
      const value = Number(body.percentOff ?? 0);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        return badRequest(reply, "percentOff must be between 1 and 100");
      }
      percentOff = Math.round(value);
    }
    if (kind === "AMOUNT_OFF") {
      const value = Number(body.amountOffCents ?? 0);
      if (!Number.isFinite(value) || value <= 0) {
        return badRequest(reply, "amountOffCents must be greater than 0");
      }
      amountOffCents = Math.round(value);
    }
    if (kind === "FREE_TRIAL") {
      const value = Number(body.trialDays ?? 0);
      if (!Number.isFinite(value) || value <= 0 || value > 365) {
        return badRequest(reply, "trialDays must be between 1 and 365");
      }
      trialDays = Math.round(value);
    }

    const maxRedemptions =
      typeof body.maxRedemptions === "number" && Number.isFinite(body.maxRedemptions)
        ? Math.max(1, Math.round(body.maxRedemptions))
        : null;
    const durationInMonths =
      duration === "REPEATING" && typeof body.durationInMonths === "number" && Number.isFinite(body.durationInMonths)
        ? Math.max(1, Math.round(body.durationInMonths))
        : null;
    const expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt.trim()
        ? new Date(body.expiresAt)
        : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return badRequest(reply, "expiresAt must be a valid ISO date");
    }

    const stripe = getStripeClient();
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;

    if (kind === "PERCENT_OFF" || kind === "AMOUNT_OFF") {
      const stripeCoupon = await stripe.coupons.create({
        name,
        duration: durationRaw as "once" | "repeating" | "forever",
        duration_in_months: duration === "REPEATING" ? durationInMonths ?? 1 : undefined,
        max_redemptions: maxRedemptions ?? undefined,
        redeem_by: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : undefined,
        percent_off: kind === "PERCENT_OFF" ? percentOff! : undefined,
        amount_off: kind === "AMOUNT_OFF" ? amountOffCents! : undefined,
        currency: kind === "AMOUNT_OFF" ? "usd" : undefined,
        metadata: {
          code
        }
      });
      stripeCouponId = stripeCoupon.id;

      const promo = await stripe.promotionCodes.create({
        coupon: stripeCoupon.id,
        code
      });
      stripePromotionCodeId = promo.id;
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        name,
        kind,
        duration,
        percentOff,
        amountOffCents,
        trialDays,
        durationInMonths,
        maxRedemptions,
        expiresAt,
        isActive: body.isActive ?? true,
        stripeCouponId,
        stripePromotionCodeId
      }
    });

    return reply.status(201).send({
      id: coupon.id,
      code: coupon.code
    });
  });

  app.patch("/v1/admin/coupons/:id", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { isActive?: boolean; expiresAt?: string | null; maxRedemptions?: number | null };

    const existing = await db.coupon.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Coupon not found" });
    }

    const data: { isActive?: boolean; expiresAt?: Date | null; maxRedemptions?: number | null } = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.expiresAt === null) data.expiresAt = null;
    if (typeof body.expiresAt === "string") {
      const dt = new Date(body.expiresAt);
      if (Number.isNaN(dt.getTime())) return badRequest(reply, "expiresAt must be a valid ISO date");
      data.expiresAt = dt;
    }
    if (body.maxRedemptions === null) data.maxRedemptions = null;
    if (typeof body.maxRedemptions === "number") data.maxRedemptions = Math.max(1, Math.round(body.maxRedemptions));

    const updated = await db.coupon.update({
      where: { id },
      data
    });

    return {
      id: updated.id,
      isActive: updated.isActive,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
      maxRedemptions: updated.maxRedemptions
    };
  });

  app.get("/v1/admin/analytics", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const query = (request.query ?? {}) as { days?: string | number; startDate?: string; endDate?: string };
    const startDateParsed = parseDateInput(query.startDate);
    const endDateParsed = parseDateInput(query.endDate);
    const hasCustomRange = Boolean(startDateParsed && endDateParsed);

    const rawDays = Number(query.days ?? 30);
    const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(365, Math.floor(rawDays))) : 30;

    const now = new Date();
    const fallbackSince = new Date(now.getTime() - days * DAY_MS);
    const fallbackUntil = now;

    const rangeStart = hasCustomRange ? startDateParsed! : fallbackSince;
    const rangeEndInclusive = hasCustomRange ? endDateParsed! : now;
    const since = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
    const until = hasCustomRange
      ? addDays(new Date(Date.UTC(rangeEndInclusive.getUTCFullYear(), rangeEndInclusive.getUTCMonth(), rangeEndInclusive.getUTCDate())), 1)
      : fallbackUntil;

    if (until <= since) {
      return badRequest(reply, "endDate must be the same as or after startDate");
    }

    const [
      publishedCount,
      draftCount,
      archivedCount,
      watchAgg,
      completedViews,
      inProgressViews,
      myListAdds,
      newUsersCount,
      monthlyPlan,
      topWatchedRows,
      topSavedRows,
      deviceStatusRows,
      recentWatch,
      recentDevice,
      newUserRows,
      canceledSubRows,
      watchRows,
      myListRows
    ] = await Promise.all([
      prisma.contentItem.count({ where: { publishStatus: PublishStatus.PUBLISHED } }),
      prisma.contentItem.count({ where: { publishStatus: PublishStatus.DRAFT } }),
      prisma.contentItem.count({ where: { publishStatus: PublishStatus.ARCHIVED } }),
      prisma.watchProgress.aggregate({
        where: { updatedAt: { gte: since, lt: until } },
        _sum: { positionSeconds: true },
        _avg: { progressPercent: true },
        _count: { _all: true }
      }),
      prisma.watchProgress.count({
        where: { updatedAt: { gte: since, lt: until }, completed: true }
      }),
      prisma.watchProgress.count({
        where: { updatedAt: { gte: since, lt: until }, completed: false, positionSeconds: { gt: 0 } }
      }),
      prisma.myListItem.count({
        where: { createdAt: { gte: since, lt: until } }
      }),
      prisma.user.count({
        where: { createdAt: { gte: since, lt: until }, role: "VIEWER" }
      }),
      prisma.plan.findFirst({
        where: { isActive: true, interval: "month" },
        orderBy: { priceCents: "asc" }
      }),
      prisma.watchProgress.groupBy({
        by: ["contentId"],
        where: { updatedAt: { gte: since, lt: until } },
        _count: { contentId: true },
        _sum: { positionSeconds: true },
        _avg: { progressPercent: true },
        orderBy: { _count: { contentId: "desc" } },
        take: 8
      }),
      prisma.myListItem.groupBy({
        by: ["contentId"],
        where: { createdAt: { gte: since, lt: until } },
        _count: { contentId: true },
        orderBy: { _count: { contentId: "desc" } },
        take: 8
      }),
      prisma.deviceLoginSession.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since, lt: until } },
        _count: { _all: true }
      }),
      prisma.watchProgress.findMany({
        where: { updatedAt: { gte: since, lt: until } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        include: {
          user: { select: { displayName: true, email: true } },
          content: { select: { title: true, slug: true } }
        }
      }),
      prisma.deviceLoginSession.findMany({
        where: { createdAt: { gte: since, lt: until } },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.user.findMany({
        where: { role: "VIEWER", createdAt: { gte: since, lt: until } },
        select: {
          id: true,
          createdAt: true,
          subscriptions: {
            select: { status: true, createdAt: true }
          }
        }
      }),
      prisma.subscription.findMany({
        where: { status: SubscriptionStatus.CANCELED, createdAt: { gte: since, lt: until } },
        select: { createdAt: true }
      }),
      prisma.watchProgress.findMany({
        where: { updatedAt: { gte: since, lt: until } },
        select: { updatedAt: true, positionSeconds: true }
      }),
      prisma.myListItem.findMany({
        where: { createdAt: { gte: since, lt: until } },
        select: { createdAt: true }
      })
    ]);

    const [watchedContent, savedContent, allUsers] = await Promise.all([
      prisma.contentItem.findMany({
        where: { id: { in: topWatchedRows.map((row) => row.contentId) } },
        select: { id: true, title: true, slug: true }
      }),
      prisma.contentItem.findMany({
        where: { id: { in: topSavedRows.map((row) => row.contentId) } },
        select: { id: true, title: true, slug: true }
      }),
      prisma.user.findMany({
        include: {
          subscriptions: {
            orderBy: [{ updatedAt: "desc" }],
            take: 1
          }
        }
      })
    ]);

    const watchedMap = new Map(watchedContent.map((item) => [item.id, item]));
    const savedMap = new Map(savedContent.map((item) => [item.id, item]));

    const subscriptionStatusCounts = allUsers.reduce<Record<string, number>>((acc, user) => {
      if (user.role === "ADMIN") {
        return acc;
      }
      const status = user.subscriptions[0]?.status.toLowerCase() ?? "none";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const activeSubscribers = (subscriptionStatusCounts.active ?? 0) + (subscriptionStatusCounts.trialing ?? 0);
    const estimatedMrr = Number((((monthlyPlan?.priceCents ?? 0) / 100) * activeSubscribers).toFixed(2));
    const rangeDays = Math.max(1, Math.ceil((until.getTime() - since.getTime()) / DAY_MS));

    const trendByDay = new Map<string, { date: string; newUsers: number; cancellations: number; watchHours: number; myListAdds: number }>();
    for (let i = 0; i < rangeDays; i += 1) {
      const day = addDays(since, i);
      const key = toDateKey(day);
      trendByDay.set(key, {
        date: key,
        newUsers: 0,
        cancellations: 0,
        watchHours: 0,
        myListAdds: 0
      });
    }

    for (const row of newUserRows) {
      const key = toDateKey(row.createdAt);
      const bucket = trendByDay.get(key);
      if (bucket) bucket.newUsers += 1;
    }
    for (const row of canceledSubRows) {
      const key = toDateKey(row.createdAt);
      const bucket = trendByDay.get(key);
      if (bucket) bucket.cancellations += 1;
    }
    for (const row of watchRows) {
      const key = toDateKey(row.updatedAt);
      const bucket = trendByDay.get(key);
      if (bucket) bucket.watchHours += row.positionSeconds / 3600;
    }
    for (const row of myListRows) {
      const key = toDateKey(row.createdAt);
      const bucket = trendByDay.get(key);
      if (bucket) bucket.myListAdds += 1;
    }

    const trends = [...trendByDay.values()].map((row) => ({
      ...row,
      watchHours: Number(row.watchHours.toFixed(2))
    }));

    const cohorts = new Map<string, { cohortStart: string; signups: number; converted7d: number }>();
    for (const user of newUserRows) {
      const cohortStart = toDateKey(weekStartUtc(user.createdAt));
      const existing = cohorts.get(cohortStart) ?? { cohortStart, signups: 0, converted7d: 0 };
      existing.signups += 1;

      const limit = user.createdAt.getTime() + 7 * DAY_MS;
      const converted = user.subscriptions.some(
        (sub) =>
          (sub.status === SubscriptionStatus.TRIALING || sub.status === SubscriptionStatus.ACTIVE) &&
          sub.createdAt.getTime() <= limit
      );
      if (converted) existing.converted7d += 1;
      cohorts.set(cohortStart, existing);
    }
    const cohortRows = [...cohorts.values()]
      .sort((a, b) => a.cohortStart.localeCompare(b.cohortStart))
      .map((row) => ({
        ...row,
        conversionRate7d: row.signups > 0 ? Number(((row.converted7d / row.signups) * 100).toFixed(1)) : 0
      }));

    return {
      windowDays: rangeDays,
      startDate: toDateKey(since),
      endDate: toDateKey(addDays(until, -1)),
      generatedAt: new Date().toISOString(),
      kpis: {
        publishedCount,
        draftCount,
        archivedCount,
        activeSubscribers,
        estimatedMrr,
        newUsers: newUsersCount,
        watchEvents: watchAgg._count._all,
        watchHours: Number((((watchAgg._sum.positionSeconds ?? 0) / 3600)).toFixed(2)),
        avgProgressPercent: Math.round(watchAgg._avg.progressPercent ?? 0),
        completedViews,
        inProgressViews,
        myListAdds
      },
      subscriptionStatusCounts,
      deviceStatusCounts: Object.fromEntries(deviceStatusRows.map((row) => [row.status.toLowerCase(), row._count._all])),
      topWatched: topWatchedRows.map((row) => ({
        contentId: row.contentId,
        title: watchedMap.get(row.contentId)?.title ?? "(deleted)",
        slug: watchedMap.get(row.contentId)?.slug ?? "",
        watchEvents: row._count?.contentId ?? 0,
        watchHours: Number((((row._sum.positionSeconds ?? 0) / 3600)).toFixed(2)),
        avgProgressPercent: Math.round(row._avg.progressPercent ?? 0)
      })),
      topSaved: topSavedRows.map((row) => ({
        contentId: row.contentId,
        title: savedMap.get(row.contentId)?.title ?? "(deleted)",
        slug: savedMap.get(row.contentId)?.slug ?? "",
        saves: row._count?.contentId ?? 0
      })),
      recentWatchActivity: recentWatch.map((row) => ({
        id: row.id,
        at: row.updatedAt.toISOString(),
        viewer: row.user.displayName || row.user.email,
        contentTitle: row.content.title,
        contentSlug: row.content.slug,
        progressPercent: Math.round(row.progressPercent),
        completed: row.completed
      })),
      recentDeviceActivity: recentDevice.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        clientName: row.clientName ?? "unknown",
        status: row.status.toLowerCase(),
        code: row.userCode
      })),
      trends,
      cohorts: cohortRows
    };
  });

  app.get("/v1/admin/analytics/videos", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const query = (request.query ?? {}) as {
      days?: string | number;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      q?: string;
      author?: string;
      limit?: string | number;
    };

    const startDateParsed = parseDateInput(query.startDate);
    const endDateParsed = parseDateInput(query.endDate);
    const hasCustomRange = Boolean(startDateParsed && endDateParsed);
    const rawDays = Number(query.days ?? 30);
    const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(365, Math.floor(rawDays))) : 30;
    const now = new Date();
    const fallbackSince = new Date(now.getTime() - days * DAY_MS);
    const rangeStart = hasCustomRange ? startDateParsed! : fallbackSince;
    const rangeEndInclusive = hasCustomRange ? endDateParsed! : now;
    const since = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
    const until = hasCustomRange
      ? addDays(new Date(Date.UTC(rangeEndInclusive.getUTCFullYear(), rangeEndInclusive.getUTCMonth(), rangeEndInclusive.getUTCDate())), 1)
      : now;

    if (until <= since) {
      return badRequest(reply, "endDate must be the same as or after startDate");
    }

    const sortBy = (query.sortBy ?? "watchHours").toString();
    if (!["watchHours", "watchEvents", "avgProgressPercent"].includes(sortBy)) {
      return badRequest(reply, "Invalid sortBy");
    }
    const q = (query.q ?? "").toString().trim();
    const author = (query.author ?? "").toString().trim();
    const rawLimit = Number(query.limit ?? 100);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 100;

    const where = {
      updatedAt: { gte: since, lt: until },
      content: {
        ...(author ? { author: { equals: author, mode: "insensitive" as const } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { synopsis: { contains: q, mode: "insensitive" as const } },
                { author: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {})
      }
    };

    const grouped = await prisma.watchProgress.groupBy({
      by: ["contentId"],
      where,
      _count: { contentId: true },
      _sum: { positionSeconds: true },
      _avg: { progressPercent: true },
      orderBy:
        sortBy === "watchEvents"
          ? { _count: { contentId: "desc" } }
          : sortBy === "avgProgressPercent"
            ? { _avg: { progressPercent: "desc" } }
            : { _sum: { positionSeconds: "desc" } },
      take: limit
    });

    const contentRows = await prisma.contentItem.findMany({
      where: { id: { in: grouped.map((row) => row.contentId) } },
      select: { id: true, title: true, slug: true, author: true, durationSeconds: true, releaseYear: true }
    });
    const contentMap = new Map(contentRows.map((row) => [row.id, row]));

    return {
      startDate: toDateKey(since),
      endDate: toDateKey(addDays(until, -1)),
      sortBy,
      total: grouped.length,
      items: grouped.map((row) => ({
        contentId: row.contentId,
        title: contentMap.get(row.contentId)?.title ?? "(deleted)",
        slug: contentMap.get(row.contentId)?.slug ?? "",
        author: contentMap.get(row.contentId)?.author ?? null,
        releaseYear: contentMap.get(row.contentId)?.releaseYear ?? null,
        durationSeconds: contentMap.get(row.contentId)?.durationSeconds ?? 0,
        watchEvents: row._count.contentId ?? 0,
        watchHours: Number((((row._sum.positionSeconds ?? 0) / 3600)).toFixed(2)),
        avgProgressPercent: Math.round(row._avg.progressPercent ?? 0)
      }))
    };
  });

  app.post("/v1/admin/plans", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const body = (request.body ?? {}) as {
      code?: string;
      name?: string;
      interval?: string;
      priceCents?: number;
      currency?: string;
      providerPriceId?: string;
      isActive?: boolean;
    };

    if (!body.code || !body.name || !body.interval || typeof body.priceCents !== "number") {
      return badRequest(reply, "code, name, interval, and priceCents are required");
    }

    const plan = await prisma.plan.create({
      data: {
        code: body.code.trim(),
        name: body.name.trim(),
        interval: body.interval.trim().toLowerCase(),
        priceCents: Math.max(0, Math.round(body.priceCents)),
        currency: (body.currency ?? "USD").toUpperCase(),
        providerPriceId: body.providerPriceId?.trim() || null,
        isActive: body.isActive ?? true
      }
    });

    return reply.status(201).send({
      id: plan.id,
      code: plan.code
    });
  });

  app.patch("/v1/admin/plans/:id", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      code?: string;
      name?: string;
      interval?: string;
      priceCents?: number;
      currency?: string;
      providerPriceId?: string | null;
      isActive?: boolean;
    };

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const data: {
      code?: string;
      name?: string;
      interval?: string;
      priceCents?: number;
      currency?: string;
      providerPriceId?: string | null;
      isActive?: boolean;
    } = {};

    if (typeof body.code === "string" && body.code.trim()) data.code = body.code.trim();
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.interval === "string" && body.interval.trim()) data.interval = body.interval.trim().toLowerCase();
    if (typeof body.priceCents === "number") data.priceCents = Math.max(0, Math.round(body.priceCents));
    if (typeof body.currency === "string" && body.currency.trim()) data.currency = body.currency.trim().toUpperCase();
    if (body.providerPriceId === null) data.providerPriceId = null;
    if (typeof body.providerPriceId === "string") data.providerPriceId = body.providerPriceId.trim() || null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.plan.update({
      where: { id },
      data
    });

    return {
      id: updated.id,
      code: updated.code,
      updatedAt: updated.updatedAt.toISOString()
    };
  });

  app.post("/v1/admin/subscribers/:userId/subscriptions", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as { planCode?: string; status?: string };

    if (!body.planCode) {
      return badRequest(reply, "planCode is required");
    }

    const plan = await prisma.plan.findUnique({ where: { code: body.planCode } });
    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    const status = (body.status?.toUpperCase() as SubscriptionStatus | undefined) ?? SubscriptionStatus.ACTIVE;
    if (!(status in SubscriptionStatus)) {
      return badRequest(reply, "Invalid subscription status");
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status,
        provider: "admin"
      }
    });

    return reply.status(201).send({
      id: subscription.id,
      status: subscription.status.toLowerCase()
    });
  });
}
