import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { stripeStatusToSubscriptionStatus } from "./stripe.js";

export async function upsertStripeSubscription(params: {
  providerSubscriptionId: string;
  userId: string;
  planCode: string;
  status: string;
  currentPeriodEndUnix?: number | null;
  canceledAtUnix?: number | null;
}) {
  const plan = await prisma.plan.findUnique({ where: { code: params.planCode } });
  if (!plan) {
    throw new Error(`Plan not found for planCode '${params.planCode}'`);
  }

  const mappedStatus = stripeStatusToSubscriptionStatus(params.status);
  const existing = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: params.providerSubscriptionId }
  });

  const currentPeriodEnd =
    typeof params.currentPeriodEndUnix === "number"
      ? new Date(params.currentPeriodEndUnix * 1000)
      : null;
  const canceledAt =
    typeof params.canceledAtUnix === "number"
      ? new Date(params.canceledAtUnix * 1000)
      : mappedStatus === SubscriptionStatus.CANCELED
        ? new Date()
        : null;

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: mappedStatus,
        planId: plan.id,
        currentPeriodEnd,
        canceledAt,
        provider: "stripe"
      }
    });
    return;
  }

  await prisma.subscription.create({
    data: {
      userId: params.userId,
      planId: plan.id,
      provider: "stripe",
      providerSubscriptionId: params.providerSubscriptionId,
      status: mappedStatus,
      currentPeriodEnd,
      canceledAt
    }
  });
}
