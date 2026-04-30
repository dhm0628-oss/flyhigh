import { randomUUID } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  clearSessionCookie,
  generateOneTimeToken,
  hashOneTimeToken,
  hashPassword,
  setSessionCookie,
  signSessionToken,
  validatePasswordPolicy,
  verifyPassword
} from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { badRequest, unauthorized } from "../../lib/http.js";
import { isMailerConfigured, sendMail } from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";
import { getAuthContext, toViewerProfile } from "../../lib/viewer.js";

const registerRateLimit = { keyPrefix: "auth-register", max: 5, windowMs: 10 * 60 * 1000 };
const loginRateLimit = { keyPrefix: "auth-login", max: 10, windowMs: 10 * 60 * 1000 };
const forgotPasswordRateLimit = { keyPrefix: "auth-forgot-password", max: 5, windowMs: 10 * 60 * 1000 };
const resetPasswordRateLimit = { keyPrefix: "auth-reset-password", max: 10, windowMs: 10 * 60 * 1000 };
const passwordResetWindowMs = 1000 * 60 * 60;
const passwordResetRequiredMessage = "We've updated your Flyhigh account. Reset your password to continue.";

type MigrationStatus = "IMPORTED" | "RESET_REQUIRED" | "CLAIMED" | "MANUAL_REVIEW";

type MigrationRecord = {
  id: string;
  email: string;
  displayName: string;
  status: MigrationStatus;
  flyhighUserId: string | null;
};

type PasswordResetTokenRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function validateEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

function buildResetPasswordUrl(token: string, email: string) {
  const base = env.WEB_APP_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    token,
    email
  });
  return `${base}/account/reset-password?${params.toString()}`;
}

async function getMigrationRecordForEmail(email: string): Promise<MigrationRecord | null> {
  const rows = await prisma.$queryRaw<MigrationRecord[]>(Prisma.sql`
    SELECT "id", "email", "displayName", "status", "flyhighUserId"
    FROM "MigratedSubscriber"
    WHERE "email" = ${email}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function getMigrationRecordForUser(userId: string, email: string): Promise<MigrationRecord | null> {
  const rows = await prisma.$queryRaw<MigrationRecord[]>(Prisma.sql`
    SELECT "id", "email", "displayName", "status", "flyhighUserId"
    FROM "MigratedSubscriber"
    WHERE "flyhighUserId" = ${userId} OR "email" = ${email}
    ORDER BY CASE WHEN "flyhighUserId" = ${userId} THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function setMigrationStatus(userId: string, status: MigrationStatus, claimedAt: Date | null = null) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "MigratedSubscriber"
    SET
      "status" = CAST(${status} AS "MigratedSubscriberStatus"),
      "claimedAt" = ${claimedAt},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "flyhighUserId" = ${userId}
  `);
}

async function createPasswordResetToken(userId: string) {
  const token = generateOneTimeToken();
  const tokenHash = hashOneTimeToken(token);
  const expiresAt = new Date(Date.now() + passwordResetWindowMs);

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "PasswordResetToken"
    WHERE "userId" = ${userId}
      AND "usedAt" IS NULL
  `);

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt}, CURRENT_TIMESTAMP)
  `);

  return { token, expiresAt };
}

async function getPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRow | null> {
  const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>(Prisma.sql`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function markPasswordResetTokenUsed(tokenId: string, userId: string, usedAt: Date) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "PasswordResetToken"
    SET "usedAt" = ${usedAt}
    WHERE "id" = ${tokenId}
  `);

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "PasswordResetToken"
    WHERE "userId" = ${userId}
      AND "id" <> ${tokenId}
  `);
}

async function sendPasswordResetEmail(args: {
  email: string;
  displayName: string;
  token: string;
  migrated: boolean;
}) {
  const resetUrl = buildResetPasswordUrl(args.token, args.email);
  const intro = args.migrated
    ? "We've updated Flyhigh.tv. Reset your password to continue watching with your existing subscription."
    : "Use the link below to reset your Flyhigh.tv password.";

  await sendMail({
    to: args.email,
    subject: args.migrated ? "Reset your Flyhigh.tv password to continue" : "Reset your Flyhigh.tv password",
    text:
      `Hi ${args.displayName},\n\n` +
      `${intro}\n\n` +
      `Reset your password: ${resetUrl}\n\n` +
      `This link expires in 1 hour.\n`,
    html:
      `<div style="background:#0f1012;padding:32px 20px;font-family:Avenir Next,Avenir,Segoe UI,sans-serif;color:#ececec">` +
      `<div style="max-width:640px;margin:0 auto;background:#15171a;border:1px solid #2e3238;border-radius:20px;overflow:hidden">` +
      `<div style="padding:28px 28px 22px;border-bottom:1px solid #2e3238">` +
      `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8ec9ff;margin-bottom:12px">Flyhigh.tv</div>` +
      `<h1 style="margin:0 0 10px;font-size:30px;line-height:1.1;color:#ffffff">Reset your password</h1>` +
      `<p style="margin:0;color:#d7dde2;font-size:16px;line-height:1.6">${intro}</p>` +
      `</div>` +
      `<div style="padding:28px">` +
      `<p style="margin:0 0 18px;color:#d7dde2;font-size:15px;line-height:1.6">This link expires in 1 hour.</p>` +
      `<p style="margin:0 0 18px"><a href="${resetUrl}" style="display:inline-block;background:#7dd3fc;border-radius:999px;padding:14px 22px;font-weight:700;color:#06131d;text-decoration:none">Reset Password</a></p>` +
      `<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">If the button does not work, open this link: <a href="${resetUrl}" style="color:#8ec9ff">${resetUrl}</a></p>` +
      `</div></div></div>`
  });
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

    const migrationRecord = await getMigrationRecordForUser(user.id, email);
    if (migrationRecord && migrationRecord.status !== "CLAIMED") {
      return reply.status(403).send({
        error: passwordResetRequiredMessage,
        code: "PASSWORD_RESET_REQUIRED"
      });
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

  app.post("/v1/auth/forgot-password", async (request, reply) => {
    if (!enforceRateLimit(forgotPasswordRateLimit, request, reply, { message: "Too many reset attempts. Please wait and try again." })) {
      return reply;
    }

    if (!isMailerConfigured()) {
      return reply.status(503).send({ error: "Email service is not configured" });
    }

    const body = (request.body ?? {}) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email || !validateEmail(email)) {
      return badRequest(reply, "Valid email is required");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { ok: true };
    }

    const migrationRecord = await getMigrationRecordForEmail(email);
    const { token } = await createPasswordResetToken(user.id);

    if (migrationRecord?.flyhighUserId === user.id || migrationRecord?.email === email) {
      await setMigrationStatus(user.id, "RESET_REQUIRED");
    }

    await sendPasswordResetEmail({
      email: user.email,
      displayName: user.displayName,
      token,
      migrated: Boolean(migrationRecord)
    });

    return { ok: true };
  });

  app.post("/v1/auth/reset-password", async (request, reply) => {
    if (!enforceRateLimit(resetPasswordRateLimit, request, reply, { message: "Too many password reset attempts. Please wait and try again." })) {
      return reply;
    }

    const body = (request.body ?? {}) as { token?: string; password?: string };
    const token = body.token?.trim() ?? "";
    const password = body.password ?? "";

    if (!token || !password) {
      return badRequest(reply, "Token and password are required");
    }

    const passwordPolicyError = validatePasswordPolicy(password);
    if (passwordPolicyError) {
      return badRequest(reply, passwordPolicyError);
    }

    const resetToken = await getPasswordResetToken(hashOneTimeToken(token));
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
      return reply.status(400).send({ error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(password);
    const claimedAt = new Date();

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    });

    await markPasswordResetTokenUsed(resetToken.id, resetToken.userId, claimedAt);
    await setMigrationStatus(resetToken.userId, "CLAIMED", claimedAt);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: resetToken.userId },
      include: {
        subscriptions: {
          orderBy: [{ updatedAt: "desc" }],
          take: 1
        }
      }
    });

    const sessionToken = signSessionToken({ sub: updatedUser.id, role: updatedUser.role });
    setSessionCookie(reply, sessionToken);

    return {
      authenticated: true,
      viewer: toViewerProfile(updatedUser, updatedUser.subscriptions[0]?.status),
      role: updatedUser.role
    };
  });

  app.post("/v1/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
