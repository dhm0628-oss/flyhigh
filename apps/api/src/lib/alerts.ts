import type { FastifyBaseLogger } from "fastify";
import { env } from "./env.js";

export type OpsAlertPayload = {
  service: "flyhigh-api";
  level: "warn" | "error";
  kind: "api_error" | "payment_failure" | "playback_failure" | "security_block";
  message: string;
  reqId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  at?: string;
};

export async function sendOpsAlert(payload: OpsAlertPayload, logger?: FastifyBaseLogger) {
  if (!env.ALERT_WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        at: payload.at ?? new Date().toISOString()
      })
    });
  } catch (err) {
    logger?.error({ err }, "ops.alert.failed");
  }
}

