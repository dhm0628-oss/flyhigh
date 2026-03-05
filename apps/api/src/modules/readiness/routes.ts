import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { forbidden, unauthorized } from "../../lib/http.js";
import { getReadinessReport } from "../../lib/readiness.js";
import { getAuthContext } from "../../lib/viewer.js";

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

export async function registerReadinessRoutes(app: FastifyInstance) {
  app.get("/v1/admin/readiness", async (request, reply) => {
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return reply;
    }

    return getReadinessReport();
  });
}
