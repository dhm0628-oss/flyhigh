import type { FastifyInstance } from "fastify";
import { badRequest } from "../../lib/http.js";
import { env } from "../../lib/env.js";
import { isMailerConfigured, sendMail } from "../../lib/mailer.js";
import { enforceRateLimit } from "../../lib/rate-limit.js";

const sponsorshipRateLimit = { keyPrefix: "inquiry-sponsorship", max: 5, windowMs: 60 * 60 * 1000 };
const contactRateLimit = { keyPrefix: "inquiry-contact", max: 8, windowMs: 60 * 60 * 1000 };

function isEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function failedBotGuard(body: { website?: string; formStartedAt?: number }) {
  const honeypot = body.website?.trim() ?? "";
  if (honeypot) {
    return true;
  }

  if (typeof body.formStartedAt === "number") {
    const elapsed = Date.now() - body.formStartedAt;
    if (elapsed >= 0 && elapsed < 1200) {
      return true;
    }
  }

  return false;
}

export async function registerInquiryRoutes(app: FastifyInstance) {
  app.post("/v1/inquiries/sponsorship", async (request, reply) => {
    if (!enforceRateLimit(sponsorshipRateLimit, request, reply, { message: "Too many sponsorship submissions. Please try again later." })) {
      return reply;
    }

    const body = (request.body ?? {}) as {
      name?: string;
      email?: string;
      ridingYears?: string;
      advancedTricks?: string;
      sponsorshipLevel?: string;
      whyWakeboarding?: string;
      website?: string;
      formStartedAt?: number;
    };

    if (failedBotGuard(body)) {
      return reply.status(202).send({ ok: true });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const ridingYears = body.ridingYears?.trim() ?? "";
    const advancedTricks = body.advancedTricks?.trim() ?? "";
    const sponsorshipLevel = body.sponsorshipLevel?.trim() ?? "";
    const whyWakeboarding = body.whyWakeboarding?.trim() ?? "";

    if (name.length < 2) {
      return badRequest(reply, "Name is required");
    }
    if (!email || !isEmail(email)) {
      return badRequest(reply, "Valid email is required");
    }
    if (!ridingYears) {
      return badRequest(reply, "Please tell us how long you have been riding");
    }
    if (!advancedTricks) {
      return badRequest(reply, "Please list a few advanced tricks");
    }
    if (!["Pro", "Advanced", "Beginner"].includes(sponsorshipLevel)) {
      return badRequest(reply, "Please choose a sponsorship level");
    }
    if (!whyWakeboarding) {
      return badRequest(reply, "Please tell us what you love about wakeboarding");
    }
    if (!isMailerConfigured()) {
      return reply.status(503).send({ error: "Email service is not configured yet" });
    }

    const subject = `FlyHigh TV sponsorship inquiry: ${name} (${sponsorshipLevel})`;
    const text = [
      "New FlyHigh TV sponsorship inquiry",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Sponsorship Level: ${sponsorshipLevel}`,
      `How long have you been riding?: ${ridingYears}`,
      "",
      "Most advanced tricks:",
      advancedTricks,
      "",
      "What do you love about wakeboarding?",
      whyWakeboarding
    ].join("\n");

    const html = `
      <h2>New FlyHigh TV sponsorship inquiry</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Sponsorship Level:</strong> ${esc(sponsorshipLevel)}</p>
      <p><strong>How long have you been riding?</strong><br />${esc(ridingYears)}</p>
      <p><strong>Most advanced tricks:</strong><br />${esc(advancedTricks).replaceAll("\n", "<br />")}</p>
      <p><strong>What do you love about wakeboarding?</strong><br />${esc(whyWakeboarding).replaceAll("\n", "<br />")}</p>
    `;

    await sendMail({
      to: env.SPONSORSHIP_TO_EMAIL,
      subject,
      text,
      html,
      replyTo: email
    });

    return reply.status(201).send({ ok: true });
  });

  app.post("/v1/inquiries/contact", async (request, reply) => {
    if (!enforceRateLimit(contactRateLimit, request, reply, { message: "Too many contact form submissions. Please try again later." })) {
      return reply;
    }

    const body = (request.body ?? {}) as {
      name?: string;
      email?: string;
      inquiryType?: string;
      message?: string;
      website?: string;
      formStartedAt?: number;
    };

    if (failedBotGuard(body)) {
      return reply.status(202).send({ ok: true });
    }

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const inquiryType = body.inquiryType?.trim() ?? "";
    const message = body.message?.trim() ?? "";

    if (name.length < 2) {
      return badRequest(reply, "Name is required");
    }
    if (!email || !isEmail(email)) {
      return badRequest(reply, "Valid email is required");
    }
    if (!["General", "Billing", "Technical", "TV Activation", "Business"].includes(inquiryType)) {
      return badRequest(reply, "Please choose an inquiry type");
    }
    if (!message) {
      return badRequest(reply, "Please enter your question");
    }
    if (!isMailerConfigured()) {
      return reply.status(503).send({ error: "Email service is not configured yet" });
    }

    const subject = `FlyHigh TV contact inquiry: ${name} (${inquiryType})`;
    const text = [
      "New FlyHigh TV contact inquiry",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Inquiry Type: ${inquiryType}`,
      "",
      "Question:",
      message
    ].join("\n");

    const html = `
      <h2>New FlyHigh TV contact inquiry</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Inquiry Type:</strong> ${esc(inquiryType)}</p>
      <p><strong>Question:</strong><br />${esc(message).replaceAll("\n", "<br />")}</p>
    `;

    await sendMail({
      to: env.CONTACT_TO_EMAIL,
      subject,
      text,
      html,
      replyTo: email
    });

    return reply.status(201).send({ ok: true });
  });
}
