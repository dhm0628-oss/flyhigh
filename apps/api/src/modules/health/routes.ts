import type { FastifyInstance } from "fastify";
import { access, constants as fsConstants } from "node:fs/promises";
import { prisma } from "../../lib/prisma.js";
import { isMailerConfigured } from "../../lib/mailer.js";
import { getPosterUploadsDir } from "../../lib/uploads.js";
import { isStripeConfigured } from "../../lib/stripe.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    timestamp: new Date().toISOString()
  }));

  app.get("/health/live", async () => ({
    ok: true,
    timestamp: new Date().toISOString()
  }));

  app.get("/health/ready", async (_request, reply) => {
    const checks = {
      db: false,
      stripe: false,
      mailer: false,
      storage: false
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch (err) {
      app.log.error({ err }, "Readiness check failed");
    }

    checks.stripe = isStripeConfigured();
    checks.mailer = isMailerConfigured();

    try {
      await access(getPosterUploadsDir(), fsConstants.R_OK | fsConstants.W_OK);
      checks.storage = true;
    } catch (err) {
      app.log.error({ err }, "Storage readiness check failed");
    }

    const ok = checks.db && checks.storage;
    const statusCode = ok ? 200 : 503;

    return reply.status(statusCode).send({
      ok,
      checks,
      timestamp: new Date().toISOString()
    });
  });
}
