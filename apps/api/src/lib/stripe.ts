import Stripe from "stripe";
import { SubscriptionStatus } from "@prisma/client";
import { env } from "./env.js";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil"
    });
  }
  return stripeClient;
}

export function stripeStatusToSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}
