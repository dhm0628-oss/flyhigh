import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

type CsvRow = Record<string, string>;

type Options = {
  uscreenFile: string;
  stripeFile: string;
  apply: boolean;
  limit: number | null;
};

type UscreenRow = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  subscriptionPlan: string;
  nextInvoiceDate: Date | null;
};

type StripeRow = {
  subscriptionId: string;
  customerId: string;
  email: string;
  customerName: string;
  plan: string;
  interval: string;
  status: string;
  currentPeriodEnd: Date | null;
  metadataUserId: string;
};

type Summary = {
  uscreenRows: number;
  stripeRows: number;
  matched: number;
  migratedUsersCreated: number;
  existingUsersLinked: number;
  subscriptionsCreated: number;
  subscriptionsUpdated: number;
  manualReview: number;
  skipped: number;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    uscreenFile: "",
    stripeFile: "",
    apply: false,
    limit: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--uscreen-file") {
      options.uscreenFile = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--stripe-file") {
      options.stripeFile = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--limit") {
      const raw = Number(argv[i + 1] ?? "");
      options.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
      i += 1;
    }
  }

  if (!options.uscreenFile || !options.stripeFile) {
    throw new Error("Missing required --uscreen-file or --stripe-file argument");
  }

  return options;
}

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        currentField += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.some((value) => value.length > 0)) rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row) => {
    const out: CsvRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      out[headers[i]] = (row[i] ?? "").trim();
    }
    return out;
  });
}

function toDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeUscreenRows(rows: CsvRow[]): UscreenRow[] {
  return rows
    .map((row) => ({
      userId: row["User ID"]?.trim() ?? "",
      email: normalizeEmail(row["User email"] ?? ""),
      displayName: row["User Name"]?.trim() || "Flyhigh Member",
      status: row["Status"]?.trim() ?? "",
      subscriptionPlan: row["Subscription Plan"]?.trim() ?? "",
      nextInvoiceDate: toDate(row["Next invoice date"] ?? "")
    }))
    .filter((row) => row.userId && row.email);
}

function normalizeStripeRows(rows: CsvRow[]): StripeRow[] {
  return rows
    .map((row) => ({
      subscriptionId: row["id"]?.trim() ?? "",
      customerId: row["Customer ID"]?.trim() ?? "",
      email: normalizeEmail(row["Customer Email"] ?? ""),
      customerName: row["Customer Name"]?.trim() || "Flyhigh Member",
      plan: row["Plan"]?.trim() ?? "",
      interval: row["Interval"]?.trim().toLowerCase() ?? "",
      status: row["Status"]?.trim().toLowerCase() ?? "",
      currentPeriodEnd: toDate(row["Current Period End (UTC)"] ?? ""),
      metadataUserId: row["user_id (metadata)"]?.trim() ?? ""
    }))
    .filter((row) => row.subscriptionId && row.email && row.metadataUserId);
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}

function inferPlanCode(row: StripeRow, uscreen: UscreenRow): string | null {
  const joined = `${row.plan} ${uscreen.subscriptionPlan}`.toLowerCase();
  if (row.interval === "year" || row.interval === "annual" || joined.includes("annual") || joined.includes("year")) {
    return "yearly";
  }
  if (row.interval === "month" || joined.includes("month")) {
    return "monthly";
  }
  return null;
}

function randomStrongPassword(length = 24): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const uscreenCsv = await readFile(path.resolve(process.cwd(), options.uscreenFile), "utf8");
  const stripeCsv = await readFile(path.resolve(process.cwd(), options.stripeFile), "utf8");

  const uscreenRows = normalizeUscreenRows(parseCsv(uscreenCsv));
  const stripeRows = normalizeStripeRows(parseCsv(stripeCsv));
  const stripeByUserId = new Map(stripeRows.map((row) => [row.metadataUserId, row]));
  const limitedRows = options.limit ? uscreenRows.slice(0, options.limit) : uscreenRows;

  const planByCode = new Map<string, string>();
  if (options.apply) {
    const plans = await prisma.plan.findMany({
      where: { code: { in: ["monthly", "yearly"] } },
      select: { id: true, code: true }
    });
    for (const plan of plans) {
      planByCode.set(plan.code, plan.id);
    }
  }

  const summary: Summary = {
    uscreenRows: limitedRows.length,
    stripeRows: stripeRows.length,
    matched: 0,
    migratedUsersCreated: 0,
    existingUsersLinked: 0,
    subscriptionsCreated: 0,
    subscriptionsUpdated: 0,
    manualReview: 0,
    skipped: 0
  };

  for (const uscreen of limitedRows) {
    const stripe = stripeByUserId.get(uscreen.userId);
    if (!stripe) {
      summary.skipped += 1;
      continue;
    }

    if (stripe.email !== uscreen.email) {
      summary.manualReview += 1;
      console.warn(`Manual review: email mismatch for Uscreen user ${uscreen.userId} (${uscreen.email} vs ${stripe.email})`);
      continue;
    }

    const planCode = inferPlanCode(stripe, uscreen);
    const planId = options.apply && planCode ? planByCode.get(planCode) ?? null : planCode;
    if (!planCode || !planId) {
      summary.manualReview += 1;
      console.warn(`Manual review: could not infer plan for ${uscreen.email}`);
      continue;
    }

    summary.matched += 1;
    if (!options.apply) {
      continue;
    }

    let user = await prisma.user.findUnique({ where: { email: uscreen.email } });
    if (user) {
      summary.existingUsersLinked += 1;
      if (!user.displayName || user.displayName === "Flyhigh Member") {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { displayName: uscreen.displayName || stripe.customerName || "Flyhigh Member" }
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: uscreen.email,
          displayName: uscreen.displayName || stripe.customerName || "Flyhigh Member",
          passwordHash: await bcrypt.hash(randomStrongPassword(), 10)
        }
      });
      summary.migratedUsersCreated += 1;
    }

    const subscriptionStatus = mapStripeStatus(stripe.status);
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        OR: [
          { providerSubscriptionId: stripe.subscriptionId },
          { userId: user.id, provider: "stripe" }
        ]
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          userId: user.id,
          planId,
          provider: "stripe",
          providerSubscriptionId: stripe.subscriptionId,
          status: subscriptionStatus,
          currentPeriodEnd: stripe.currentPeriodEnd,
          canceledAt: subscriptionStatus === SubscriptionStatus.CANCELED ? stripe.currentPeriodEnd : null
        }
      });
      summary.subscriptionsUpdated += 1;
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId,
          provider: "stripe",
          providerSubscriptionId: stripe.subscriptionId,
          status: subscriptionStatus,
          currentPeriodEnd: stripe.currentPeriodEnd,
          canceledAt: subscriptionStatus === SubscriptionStatus.CANCELED ? stripe.currentPeriodEnd : null
        }
      });
      summary.subscriptionsCreated += 1;
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "MigratedSubscriber" (
        "id",
        "uscreenUserId",
        "email",
        "displayName",
        "uscreenStatus",
        "uscreenPlanName",
        "uscreenNextInvoiceDate",
        "stripeCustomerId",
        "stripeSubscriptionId",
        "stripeStatus",
        "stripeCurrentPeriodEnd",
        "status",
        "flyhighUserId",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $13,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        CAST($11 AS "MigratedSubscriberStatus"),
        $12,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("uscreenUserId")
      DO UPDATE SET
        "email" = EXCLUDED."email",
        "displayName" = EXCLUDED."displayName",
        "uscreenStatus" = EXCLUDED."uscreenStatus",
        "uscreenPlanName" = EXCLUDED."uscreenPlanName",
        "uscreenNextInvoiceDate" = EXCLUDED."uscreenNextInvoiceDate",
        "stripeCustomerId" = EXCLUDED."stripeCustomerId",
        "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId",
        "stripeStatus" = EXCLUDED."stripeStatus",
        "stripeCurrentPeriodEnd" = EXCLUDED."stripeCurrentPeriodEnd",
        "status" = EXCLUDED."status",
        "flyhighUserId" = EXCLUDED."flyhighUserId",
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      uscreen.userId,
      uscreen.email,
      uscreen.displayName || stripe.customerName || "Flyhigh Member",
      uscreen.status || null,
      uscreen.subscriptionPlan || null,
      uscreen.nextInvoiceDate,
      stripe.customerId || null,
      stripe.subscriptionId,
      stripe.status || null,
      stripe.currentPeriodEnd,
      "RESET_REQUIRED",
      user.id,
      randomUUID()
    );
  }

  console.log("Migrated subscriber import summary:", summary);
  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to write to DB.");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
