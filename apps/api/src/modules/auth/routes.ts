import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  signSessionToken,
  validatePasswordPolicy,
  verifyPassword
} from "../../lib/auth.js";
import { badRequest, unauthorized } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";
import { getAuthContext, toViewerProfile } from "../../lib/viewer.js";

const registerRateLimit = { keyPrefix: "auth-register", max: 5, windowMs: 10 * 60 * 1000 };
const loginRateLimit = { keyPrefix: "auth-login", max: 10, windowMs: 10 * 60 * 1000 };

function validateEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/v1/auth/session", async (request) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return {
        authenticated: false,
        viewer: null
      };
    }

    return {
      authenticated: true,
      viewer: toViewerProfile(auth.user, auth.latestSubscription?.status)
    };
  });

  app.post("/v1/auth/register", async (request, reply) => {
    if (!enforceRateLimit(registerRateLimit, request, reply, { message: "Too many sign-up attempts. Please wait and try again." })) {
      return reply;
    }

    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = body.displayName?.trim() ?? "";

    if (!email || !validateEmail(email)) {
      return badRequest(reply, "Valid email is required");
    }
    if (displayName.length < 2) {
      return badRequest(reply, "Display name must be at least 2 characters");
    }
    const passwordPolicyError = validatePasswordPolicy(password);
    if (passwordPolicyError) {
      return badRequest(reply, passwordPolicyError);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already in use" });
    }

    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    const role = adminCount === 0 ? Role.ADMIN : Role.VIEWER;
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        role
      }
    });

    const token = signSessionToken({ sub: user.id, role: user.role });
    setSessionCookie(reply, token);

    return reply.status(201).send({
      authenticated: true,
      viewer: toViewerProfile(user),
      role: user.role
    });
  });

  app.post("/v1/auth/login", async (request, reply) => {
    if (!enforceRateLimit(loginRateLimit, request, reply, { message: "Too many login attempts. Please wait and try again." })) {
      return reply;
    }

    const body = (request.body ?? {}) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return badRequest(reply, "Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1
        }
      }
    });

    if (!user) {
      return unauthorized(reply, "Invalid credentials");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return unauthorized(reply, "Invalid credentials");
    }

    const token = signSessionToken({ sub: user.id, role: user.role });
    setSessionCookie(reply, token);

    return {
      authenticated: true,
      viewer: toViewerProfile(user, user.subscriptions[0]?.status),
      role: user.role
    };
  });

  app.post("/v1/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
