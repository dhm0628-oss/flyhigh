function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  DATABASE_URL: requireEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/flyhigh"),
  JWT_SECRET: requireEnv("JWT_SECRET", "dev-only-secret-change-me"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  MUX_TOKEN_ID: process.env.MUX_TOKEN_ID ?? "",
  MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET ?? "",
  MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET ?? "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY ?? "",
  STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY ?? "",
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:3004/account?checkout=success",
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL ?? "http://localhost:3004/subscribe?checkout=cancel",
  STRIPE_BILLING_PORTAL_RETURN_URL: process.env.STRIPE_BILLING_PORTAL_RETURN_URL ?? "http://localhost:3004/account",
  STRIPE_GIFT_CARD_SUCCESS_URL: process.env.STRIPE_GIFT_CARD_SUCCESS_URL ?? "http://localhost:3004/gift-cards?checkout=success",
  STRIPE_GIFT_CARD_CANCEL_URL: process.env.STRIPE_GIFT_CARD_CANCEL_URL ?? "http://localhost:3004/gift-cards?checkout=cancel",
  WEB_APP_URL: process.env.WEB_APP_URL ?? "http://localhost:3004",
  ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID ?? "",
  ONESIGNAL_API_KEY: process.env.ONESIGNAL_API_KEY ?? "",
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL ?? "",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_SECURE: process.env.SMTP_SECURE ?? "",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL ?? "",
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME ?? "FlyHigh TV",
  SPONSORSHIP_TO_EMAIL: process.env.SPONSORSHIP_TO_EMAIL ?? "david@flyhigh.tv",
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL ?? "info@flyhigh.tv"
};

export function getAllowedCorsOrigins(): string[] | "*" {
  if (env.CORS_ORIGIN.trim() === "*") {
    return "*";
  }

  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
