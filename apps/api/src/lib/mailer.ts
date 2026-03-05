import nodemailer from "nodemailer";
import { env } from "./env.js";

function smtpSecure(): boolean {
  if (env.SMTP_SECURE === "true") return true;
  if (env.SMTP_SECURE === "false") return false;
  return env.SMTP_PORT === 465;
}

export function isMailerConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL);
}

export async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  if (!isMailerConfigured()) {
    throw new Error("Email service is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: smtpSecure(),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  const from = env.SMTP_FROM_NAME
    ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`
    : env.SMTP_FROM_EMAIL;

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    replyTo: args.replyTo
  });
}
