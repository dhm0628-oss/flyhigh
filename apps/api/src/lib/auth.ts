import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

export const SESSION_COOKIE = "flyhigh_session";

export interface SessionClaims {
  sub: string;
  role: "ADMIN" | "VIEWER";
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a symbol";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as SessionClaims;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/"
  });
}

export function getSessionClaims(request: FastifyRequest): SessionClaims | null {
  const bearerHeader = request.headers.authorization;
  if (typeof bearerHeader === "string" && bearerHeader.toLowerCase().startsWith("bearer ")) {
    const bearerToken = bearerHeader.slice(7).trim();
    if (bearerToken) {
      return verifySessionToken(bearerToken);
    }
  }

  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}
