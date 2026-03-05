export const WEB_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const BILLING_MODE = process.env.NEXT_PUBLIC_BILLING_MODE ?? "placeholder";

export function isPlaceholderBilling() {
  return BILLING_MODE === "placeholder";
}

