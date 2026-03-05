import { SubscriptionStatus, type User } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { ViewerProfile } from "@flyhigh/contracts";
import { prisma } from "./prisma.js";
import { getSessionClaims } from "./auth.js";

const ACTIVE_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING
]);

export function mapSubscriptionStatus(status?: SubscriptionStatus): ViewerProfile["subscriptionStatus"] {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "active";
    case SubscriptionStatus.TRIALING:
      return "trialing";
    case SubscriptionStatus.PAST_DUE:
      return "past_due";
    default:
      return "inactive";
  }
}

export function hasActiveEntitlement(status?: SubscriptionStatus | null): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

export async function getAuthContext(request: FastifyRequest) {
  const claims = getSessionClaims(request);
  if (!claims) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: {
      subscriptions: {
        orderBy: [{ updatedAt: "desc" }],
        take: 20,
        include: { plan: true }
      }
    }
  });

  if (!user) {
    return null;
  }

  const latestSubscription =
    user.subscriptions.find((subscription) => hasActiveEntitlement(subscription.status)) ??
    user.subscriptions[0];
  return {
    user,
    latestSubscription
  };
}

export function toViewerProfile(user: User, status?: SubscriptionStatus): ViewerProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    subscriptionStatus: mapSubscriptionStatus(status)
  };
}
