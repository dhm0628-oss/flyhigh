import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyRawBody from "fastify-raw-body";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerContentRoutes } from "./modules/content/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerSubscriptionRoutes } from "./modules/subscriptions/routes.js";
import { registerWebhookRoutes } from "./modules/webhooks/routes.js";
import { registerDeviceAuthRoutes } from "./modules/device-auth/routes.js";
import { registerPushRoutes } from "./modules/push/routes.js";
import { registerInquiryRoutes } from "./modules/inquiries/routes.js";
import { registerGiftCardRoutes } from "./modules/gift-cards/routes.js";
import { registerReadinessRoutes } from "./modules/readiness/routes.js";
import { env, getAllowedCorsOrigins } from "./lib/env.js";
import { sendOpsAlert } from "./lib/alerts.js";
import { getReadinessReport } from "./lib/readiness.js";
import { contentTypeFromPosterExt, ensurePosterUploadsDir, getPosterUploadsDir, isSafePosterFilename } from "./lib/uploads.js";

const app = Fastify({ logger: true, bodyLimit: 12 * 1024 * 1024 });

function getDatabaseTargetSummary(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    return {
      user: parsed.username || "<empty>",
      host: parsed.hostname || "<empty>",
      port: parsed.port || "<default>",
      database: parsed.pathname?.replace(/^\//, "") || "<empty>",
      hasPassword: Boolean(parsed.password)
    };
  } catch {
    return {
      user: "<invalid>",
      host: "<invalid>",
      port: "<invalid>",
      database: "<invalid>",
      hasPassword: false
    };
  }
}

const allowedOrigins = getAllowedCorsOrigins();

await app.register(cors, {
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  preflight: true,
  strictPreflight: false,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins === "*") {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.includes(origin));
  },
  credentials: true
});

await app.register(cookie);
await app.register(fastifyRawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true
});
await ensurePosterUploadsDir();

const blockedUserAgentPattern = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|wpscan)/i;
const blockedPathPattern = /(\.\.\/|%2e%2e%2f|<script|union\s+select|\/wp-admin|\/phpmyadmin)/i;

app.addHook("onRequest", async (request, reply) => {
  const userAgentHeader = request.headers["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(" ") : userAgentHeader ?? "";
  const url = request.url || "";

  if (blockedUserAgentPattern.test(userAgent) || blockedPathPattern.test(url) || url.length > 2048) {
    request.log.warn(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent
      },
      "request.blocked_by_guard"
    );
    await sendOpsAlert(
      {
        service: "flyhigh-api",
        level: "warn",
        kind: "security_block",
        message: "Request blocked by API guard rules",
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: 403,
        metadata: { ip: request.ip, userAgent }
      },
      request.log
    );
    return reply.status(403).send({ error: "Forbidden" });
  }

  reply.header("X-Request-Id", request.id);
  request.log.info(
    {
      reqId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip
    },
    "request.start"
  );
});

app.addHook("onResponse", async (request, reply) => {
  request.log.info(
    {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode
    },
    "request.end"
  );
});

app.setErrorHandler(async (error, request, reply) => {
  const err = error as { statusCode?: number; message?: string };
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? "Unexpected error";

  request.log.error(
    {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      err: error
    },
    "request.error"
  );

  if (statusCode >= 500) {
    await sendOpsAlert(
      {
        service: "flyhigh-api",
        level: "error",
        kind: "api_error",
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode,
        message
      },
      request.log
    );
  }

  if (!reply.sent) {
    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : message
    });
  }
});

app.get("/", async () => ({
  service: "flyhigh-api",
  status: "ok"
}));

app.get("/uploads/posters/:filename", async (request, reply) => {
  const { filename } = request.params as { filename: string };
  if (!filename || !isSafePosterFilename(filename)) {
    return reply.status(404).send({ error: "Not found" });
  }

  const ext = path.extname(filename).replace(".", "");
  const filePath = path.join(getPosterUploadsDir(), filename);
  try {
    const file = await readFile(filePath);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.type(contentTypeFromPosterExt(ext));
    return reply.send(file);
  } catch {
    return reply.status(404).send({ error: "Not found" });
  }
});

await registerHealthRoutes(app);
await registerAuthRoutes(app);
await registerContentRoutes(app);
await registerSubscriptionRoutes(app);
await registerDeviceAuthRoutes(app);
await registerPushRoutes(app);
await registerInquiryRoutes(app);
await registerGiftCardRoutes(app);
await registerReadinessRoutes(app);
await registerWebhookRoutes(app);

const port = env.PORT;
const readiness = getReadinessReport();
const dbTarget = getDatabaseTargetSummary(env.DATABASE_URL);

app.log.info(
  {
    dbUser: dbTarget.user,
    dbHost: dbTarget.host,
    dbPort: dbTarget.port,
    dbName: dbTarget.database,
    dbHasPassword: dbTarget.hasPassword
  },
  "database.target"
);

for (const check of readiness.checks) {
  if (check.status !== "pass") {
    app.log.warn({ check: check.key, message: check.message }, "readiness.warning");
  }
}

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
