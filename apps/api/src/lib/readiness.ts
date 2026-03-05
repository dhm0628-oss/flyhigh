import { env, getAllowedCorsOrigins } from "./env.js";

export type ReadinessStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
}

export interface ReadinessReport {
  ready: boolean;
  status: ReadinessStatus;
  generatedAt: string;
  checks: ReadinessCheck[];
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isSecureUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

function isLocalAddress(value: string): boolean {
  return /localhost|127\.0\.0\.1|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|10\./i.test(value);
}

function collectUrlChecks(
  checks: ReadinessCheck[],
  items: Array<{ key: string; label: string; value: string }>
) {
  for (const item of items) {
    if (!item.value) {
      checks.push({
        key: item.key,
        label: item.label,
        status: "fail",
        message: "Missing URL"
      });
      continue;
    }

    if (!isHttpUrl(item.value)) {
      checks.push({
        key: item.key,
        label: item.label,
        status: "fail",
        message: "URL is not valid"
      });
      continue;
    }

    if (isLocalAddress(item.value)) {
      checks.push({
        key: item.key,
        label: item.label,
        status: "warn",
        message: "Still points to a local development address"
      });
      continue;
    }

    if (!isSecureUrl(item.value)) {
      checks.push({
        key: item.key,
        label: item.label,
        status: "warn",
        message: "Uses HTTP instead of HTTPS"
      });
      continue;
    }

    checks.push({
      key: item.key,
      label: item.label,
      status: "pass",
      message: "Configured"
    });
  }
}

export function getReadinessReport(): ReadinessReport {
  const checks: ReadinessCheck[] = [];

  checks.push({
    key: "database_url",
    label: "Database",
    status: env.DATABASE_URL ? (isLocalAddress(env.DATABASE_URL) ? "warn" : "pass") : "fail",
    message: env.DATABASE_URL
      ? isLocalAddress(env.DATABASE_URL)
        ? "Database is configured but still points to a local/private address"
        : "Configured"
      : "Missing DATABASE_URL"
  });

  checks.push({
    key: "jwt_secret",
    label: "Session signing secret",
    status:
      !env.JWT_SECRET
        ? "fail"
        : env.JWT_SECRET === "dev-only-secret-change-me"
          ? "warn"
          : "pass",
    message:
      !env.JWT_SECRET
        ? "Missing JWT_SECRET"
        : env.JWT_SECRET === "dev-only-secret-change-me"
          ? "Using development default secret"
          : "Configured"
  });

  const corsOrigins = getAllowedCorsOrigins();
  const corsStatus =
    corsOrigins === "*"
      ? "warn"
      : corsOrigins.length === 0
        ? "fail"
        : corsOrigins.some((origin) => isLocalAddress(origin))
          ? "warn"
          : "pass";
  checks.push({
    key: "cors_origin",
    label: "CORS allowlist",
    status: corsStatus,
    message:
      corsOrigins === "*"
        ? "Allows any origin"
        : corsOrigins.length === 0
          ? "No allowed origins configured"
          : corsOrigins.some((origin) => isLocalAddress(origin))
            ? "Still includes local development origins"
            : "Configured"
  });

  checks.push({
    key: "stripe_keys",
    label: "Stripe API keys",
    status: env.STRIPE_SECRET_KEY ? "pass" : "fail",
    message: env.STRIPE_SECRET_KEY ? "Configured" : "Missing STRIPE_SECRET_KEY"
  });

  checks.push({
    key: "stripe_webhook_secret",
    label: "Stripe webhook signing secret",
    status: env.STRIPE_WEBHOOK_SECRET ? "pass" : "fail",
    message: env.STRIPE_WEBHOOK_SECRET ? "Configured" : "Missing STRIPE_WEBHOOK_SECRET"
  });

  collectUrlChecks(checks, [
    { key: "stripe_success_url", label: "Stripe success URL", value: env.STRIPE_SUCCESS_URL },
    { key: "stripe_cancel_url", label: "Stripe cancel URL", value: env.STRIPE_CANCEL_URL },
    { key: "stripe_billing_return_url", label: "Stripe billing portal return URL", value: env.STRIPE_BILLING_PORTAL_RETURN_URL },
    { key: "gift_card_success_url", label: "Gift card success URL", value: env.STRIPE_GIFT_CARD_SUCCESS_URL },
    { key: "gift_card_cancel_url", label: "Gift card cancel URL", value: env.STRIPE_GIFT_CARD_CANCEL_URL }
  ]);

  checks.push({
    key: "mux_keys",
    label: "Mux API keys",
    status: env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET ? "pass" : "warn",
    message:
      env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET
        ? "Configured"
        : "Missing Mux upload credentials"
  });

  checks.push({
    key: "mux_webhook_secret",
    label: "Mux webhook signing secret",
    status: env.MUX_WEBHOOK_SECRET ? "pass" : "warn",
    message: env.MUX_WEBHOOK_SECRET ? "Configured" : "Missing MUX_WEBHOOK_SECRET"
  });

  checks.push({
    key: "smtp",
    label: "SMTP mail delivery",
    status:
      env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL
        ? "pass"
        : "warn",
    message:
      env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL
        ? "Configured"
        : "Email delivery is incomplete"
  });

  checks.push({
    key: "alert_webhook",
    label: "Error alert webhook",
    status: env.ALERT_WEBHOOK_URL ? "pass" : "warn",
    message: env.ALERT_WEBHOOK_URL ? "Configured" : "No ALERT_WEBHOOK_URL configured"
  });

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");

  return {
    ready: !hasFail,
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    generatedAt: new Date().toISOString(),
    checks
  };
}
