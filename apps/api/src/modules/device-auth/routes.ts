import type { FastifyInstance } from "fastify";
import { DeviceLoginStatus, Role } from "@prisma/client";
import { signSessionToken } from "../../lib/auth.js";
import { badRequest, forbidden, unauthorized } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";
import { getAuthContext, toViewerProfile } from "../../lib/viewer.js";

const USER_CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXPIRES_MINUTES = 10;
const POLL_INTERVAL_SECONDS = 5;
const startRateLimit = { keyPrefix: "device-auth-start", max: 15, windowMs: 10 * 60 * 1000 };
const pollRateLimit = { keyPrefix: "device-auth-poll", max: 120, windowMs: 10 * 60 * 1000 };
const activateRateLimit = { keyPrefix: "device-auth-activate", max: 20, windowMs: 10 * 60 * 1000 };
const lookupRateLimit = { keyPrefix: "device-auth-code-lookup", max: 60, windowMs: 10 * 60 * 1000 };

function makeUserCode(): string {
  let code = "";
  for (let i = 0; i < USER_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueUserCode(): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const candidate = makeUserCode();
    const existing = await prisma.deviceLoginSession.findUnique({ where: { userCode: candidate } });
    if (!existing || existing.expiresAt < new Date()) {
      return candidate;
    }
  }
  throw new Error("Could not generate unique device code");
}

async function expireStaleSessions() {
  await prisma.deviceLoginSession.updateMany({
    where: {
      status: DeviceLoginStatus.PENDING,
      expiresAt: { lt: new Date() }
    },
    data: { status: DeviceLoginStatus.EXPIRED }
  });
}

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

export async function registerDeviceAuthRoutes(app: FastifyInstance) {
  app.post("/v1/device-auth/start", async (request, reply) => {
    if (!enforceRateLimit(startRateLimit, request, reply, { message: "Too many device login requests. Please wait and try again." })) {
      return reply;
    }

    await expireStaleSessions();

    const body = (request.body ?? {}) as { clientName?: string };
    const userCode = await generateUniqueUserCode();
    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000);
    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(" ") : userAgentHeader;

    const session = await prisma.deviceLoginSession.create({
      data: {
        userCode,
        clientName: body.clientName?.trim() || "tv-app",
        userAgent: userAgent ?? null,
        expiresAt
      }
    });

    return reply.status(201).send({
      deviceLoginId: session.id,
      userCode: session.userCode,
      verificationUri: "/activate",
      verificationUriComplete: `/activate?code=${session.userCode}`,
      expiresAt: expiresAt.toISOString(),
      intervalSeconds: POLL_INTERVAL_SECONDS
    });
  });

  app.post("/v1/device-auth/poll", async (request, reply) => {
    if (!enforceRateLimit(pollRateLimit, request, reply, { message: "Too many device polling requests. Please slow down." })) {
      return reply;
    }

    await expireStaleSessions();

    const body = (request.body ?? {}) as { deviceLoginId?: string };
    if (!body.deviceLoginId) {
      return badRequest(reply, "deviceLoginId is required");
    }

    const session = await prisma.deviceLoginSession.findUnique({
      where: { id: body.deviceLoginId },
      include: { user: true }
    });

    if (!session) {
      return reply.status(404).send({ error: "Device login session not found" });
    }

    if (session.expiresAt < new Date() && session.status === DeviceLoginStatus.PENDING) {
      await prisma.deviceLoginSession.update({
        where: { id: session.id },
        data: { status: DeviceLoginStatus.EXPIRED }
      });
      return {
        status: "expired",
        intervalSeconds: POLL_INTERVAL_SECONDS
      };
    }

    if (session.status === DeviceLoginStatus.PENDING) {
      return {
        status: "pending",
        intervalSeconds: POLL_INTERVAL_SECONDS
      };
    }

    if (session.status === DeviceLoginStatus.DENIED) {
      return {
        status: "denied"
      };
    }

    if (session.status === DeviceLoginStatus.EXPIRED) {
      return {
        status: "expired"
      };
    }

    if (session.status === DeviceLoginStatus.CONSUMED) {
      return {
        status: "consumed"
      };
    }

    if (session.status === DeviceLoginStatus.APPROVED && session.user) {
      const token = signSessionToken({ sub: session.user.id, role: session.user.role });

      await prisma.deviceLoginSession.update({
        where: { id: session.id },
        data: {
          status: DeviceLoginStatus.CONSUMED,
          consumedAt: new Date()
        }
      });

      return {
        status: "approved",
        accessToken: token,
        viewer: toViewerProfile(session.user)
      };
    }

    return reply.status(409).send({ error: "Device session is in an invalid state" });
  });

  app.post("/v1/device-auth/activate", async (request, reply) => {
    if (!enforceRateLimit(activateRateLimit, request, reply, { message: "Too many code activation attempts. Please wait and try again." })) {
      return reply;
    }

    await expireStaleSessions();

    const auth = await getAuthContext(request);
    if (!auth) {
      return unauthorized(reply);
    }
    if (auth.user.role !== Role.ADMIN && auth.user.role !== Role.VIEWER) {
      return forbidden(reply);
    }

    const body = (request.body ?? {}) as { code?: string };
    const code = body.code?.trim().toUpperCase();
    if (!code || code.length < USER_CODE_LENGTH) {
      return badRequest(reply, "Valid device code is required");
    }

    const session = await prisma.deviceLoginSession.findUnique({
      where: { userCode: code }
    });

    if (!session) {
      return reply.status(404).send({ error: "Code not found" });
    }

    if (session.expiresAt < new Date()) {
      if (session.status === DeviceLoginStatus.PENDING) {
        await prisma.deviceLoginSession.update({
          where: { id: session.id },
          data: { status: DeviceLoginStatus.EXPIRED }
        });
      }
      return reply.status(410).send({ error: "Code expired" });
    }

    if (session.status !== DeviceLoginStatus.PENDING) {
      return reply.status(409).send({
        error:
          session.status === DeviceLoginStatus.APPROVED || session.status === DeviceLoginStatus.CONSUMED
            ? "Code already used"
            : `Code is ${session.status.toLowerCase()}`
      });
    }

    const updated = await prisma.deviceLoginSession.update({
      where: { id: session.id },
      data: {
        status: DeviceLoginStatus.APPROVED,
        userId: auth.user.id,
        approvedAt: new Date()
      }
    });

    return {
      ok: true,
      deviceLoginId: updated.id,
      code: updated.userCode,
      status: "approved"
    };
  });

  app.get("/v1/device-auth/code/:code", async (request, reply) => {
    if (!enforceRateLimit(lookupRateLimit, request, reply, { message: "Too many device code lookups. Please wait and try again." })) {
      return reply;
    }

    await expireStaleSessions();
    const { code } = request.params as { code: string };
    const normalized = code.trim().toUpperCase();
    const session = await prisma.deviceLoginSession.findUnique({
      where: { userCode: normalized }
    });

    if (!session) {
      return reply.status(404).send({ error: "Code not found" });
    }

    return {
      code: session.userCode,
      status: session.status.toLowerCase(),
      expiresAt: session.expiresAt.toISOString(),
      clientName: session.clientName
    };
  });

  app.get("/v1/admin/device-auth/sessions", async (request, reply) => {
    await expireStaleSessions();
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const query = (request.query ?? {}) as { status?: string; limit?: string | number };
    const statusFilter = query.status?.trim().toUpperCase();
    const limitRaw = Number(query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

    const where =
      statusFilter && statusFilter in DeviceLoginStatus
        ? { status: statusFilter as DeviceLoginStatus }
        : {};

    const sessions = await prisma.deviceLoginSession.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true
          }
        }
      }
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        userCode: session.userCode,
        status: session.status.toLowerCase(),
        clientName: session.clientName ?? "unknown",
        userAgent: session.userAgent ?? "",
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        approvedAt: session.approvedAt?.toISOString() ?? null,
        consumedAt: session.consumedAt?.toISOString() ?? null,
        user: session.user
          ? {
              id: session.user.id,
              email: session.user.email,
              displayName: session.user.displayName
            }
          : null
      }))
    };
  });

  app.post("/v1/admin/device-auth/:id/deny", async (request, reply) => {
    await expireStaleSessions();
    const auth = await requireAdmin(request, reply);
    if (!auth) {
      return;
    }

    const { id } = request.params as { id: string };
    const existing = await prisma.deviceLoginSession.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Device login session not found" });
    }

    if (existing.status !== DeviceLoginStatus.PENDING && existing.status !== DeviceLoginStatus.APPROVED) {
      return reply.status(409).send({ error: `Cannot deny session in status '${existing.status.toLowerCase()}'` });
    }

    const updated = await prisma.deviceLoginSession.update({
      where: { id },
      data: {
        status: DeviceLoginStatus.DENIED,
        userId: null
      }
    });

    return {
      ok: true,
      id: updated.id,
      status: updated.status.toLowerCase()
    };
  });
}
