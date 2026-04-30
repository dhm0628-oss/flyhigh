import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

type CsvRow = Record<string, string>;

type Options = {
  uscreenFile: string;
  stripeFile: string;
  outFile: string;
  limit: number | null;
};

type UscreenRow = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  subscriptionPlan: string;
  nextInvoiceDate: string | null;
};

type StripeRow = {
  subscriptionId: string;
  customerId: string;
  email: string;
  customerName: string;
  plan: string;
  interval: string;
  status: string;
  currentPeriodEnd: string | null;
  metadataUserId: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    uscreenFile: "",
    stripeFile: "",
    outFile: path.resolve(process.cwd(), "generated-migrated-subscribers.sql"),
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
    if (arg === "--out-file") {
      options.outFile = path.resolve(process.cwd(), (argv[i + 1] ?? "").trim());
      i += 1;
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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toIsoTimestamp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeUscreenRows(rows: CsvRow[]): UscreenRow[] {
  return rows
    .map((row) => ({
      userId: row["User ID"]?.trim() ?? "",
      email: normalizeEmail(row["User email"] ?? ""),
      displayName: row["User Name"]?.trim() || "Flyhigh Member",
      status: row["Status"]?.trim() ?? "",
      subscriptionPlan: row["Subscription Plan"]?.trim() ?? "",
      nextInvoiceDate: toIsoTimestamp(row["Next invoice date"] ?? "")
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
      currentPeriodEnd: toIsoTimestamp(row["Current Period End (UTC)"] ?? ""),
      metadataUserId: row["user_id (metadata)"]?.trim() ?? ""
    }))
    .filter((row) => row.subscriptionId && row.email && row.metadataUserId);
}

function inferPlanCode(row: StripeRow, uscreen: UscreenRow): "monthly" | "yearly" | null {
  const joined = `${row.plan} ${uscreen.subscriptionPlan}`.toLowerCase();
  if (row.interval === "year" || row.interval === "annual" || joined.includes("annual") || joined.includes("year")) {
    return "yearly";
  }
  if (row.interval === "month" || joined.includes("month")) {
    return "monthly";
  }
  return null;
}

function mapStripeStatus(status: string): string {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INACTIVE";
  }
}

function sqlString(value: string | null): string {
  if (value === null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTimestamp(value: string | null): string {
  return value ? `${sqlString(value)}::timestamptz` : "NULL";
}

async function buildStatement(uscreen: UscreenRow, stripe: StripeRow) {
  const planCode = inferPlanCode(stripe, uscreen);
  if (!planCode) {
    return null;
  }

  if (stripe.email !== uscreen.email) {
    return null;
  }

  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const userInsertId = randomUUID();
  const migrationId = randomUUID();
  const subscriptionInsertId = randomUUID();
  const displayName = uscreen.displayName || stripe.customerName || "Flyhigh Member";
  const subscriptionStatus = mapStripeStatus(stripe.status);

  return `
WITH plan_row AS (
  SELECT "id"
  FROM "Plan"
  WHERE "code" = ${sqlString(planCode)}
  LIMIT 1
),
existing_user AS (
  SELECT "id"
  FROM "User"
  WHERE "email" = ${sqlString(uscreen.email)}
  LIMIT 1
),
insert_user AS (
  INSERT INTO "User" ("id", "email", "passwordHash", "displayName", "role", "createdAt", "updatedAt")
  SELECT ${sqlString(userInsertId)}, ${sqlString(uscreen.email)}, ${sqlString(passwordHash)}, ${sqlString(displayName)}, 'VIEWER'::"Role", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM existing_user)
  RETURNING "id"
),
user_row AS (
  SELECT "id" FROM existing_user
  UNION ALL
  SELECT "id" FROM insert_user
),
updated_user AS (
  UPDATE "User"
  SET "displayName" = ${sqlString(displayName)}, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = (SELECT "id" FROM user_row LIMIT 1)
  RETURNING "id"
),
existing_subscription AS (
  SELECT "id"
  FROM "Subscription"
  WHERE "providerSubscriptionId" = ${sqlString(stripe.subscriptionId)}
     OR ("userId" = (SELECT "id" FROM user_row LIMIT 1) AND "provider" = 'stripe')
  ORDER BY "updatedAt" DESC
  LIMIT 1
),
updated_subscription AS (
  UPDATE "Subscription"
  SET
    "userId" = (SELECT "id" FROM user_row LIMIT 1),
    "planId" = (SELECT "id" FROM plan_row LIMIT 1),
    "status" = ${sqlString(subscriptionStatus)}::"SubscriptionStatus",
    "provider" = 'stripe',
    "providerSubscriptionId" = ${sqlString(stripe.subscriptionId)},
    "currentPeriodEnd" = ${sqlTimestamp(stripe.currentPeriodEnd)},
    "canceledAt" = ${subscriptionStatus === "CANCELED" ? sqlTimestamp(stripe.currentPeriodEnd) : "NULL"},
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = (SELECT "id" FROM existing_subscription LIMIT 1)
  RETURNING "id"
),
insert_subscription AS (
  INSERT INTO "Subscription" (
    "id",
    "userId",
    "planId",
    "status",
    "provider",
    "providerSubscriptionId",
    "currentPeriodEnd",
    "canceledAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    ${sqlString(subscriptionInsertId)},
    (SELECT "id" FROM user_row LIMIT 1),
    (SELECT "id" FROM plan_row LIMIT 1),
    ${sqlString(subscriptionStatus)}::"SubscriptionStatus",
    'stripe',
    ${sqlString(stripe.subscriptionId)},
    ${sqlTimestamp(stripe.currentPeriodEnd)},
    ${subscriptionStatus === "CANCELED" ? sqlTimestamp(stripe.currentPeriodEnd) : "NULL"},
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM existing_subscription)
  RETURNING "id"
)
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
  ${sqlString(migrationId)},
  ${sqlString(uscreen.userId)},
  ${sqlString(uscreen.email)},
  ${sqlString(displayName)},
  ${sqlString(uscreen.status || null)},
  ${sqlString(uscreen.subscriptionPlan || null)},
  ${sqlTimestamp(uscreen.nextInvoiceDate)},
  ${sqlString(stripe.customerId || null)},
  ${sqlString(stripe.subscriptionId)},
  ${sqlString(stripe.status || null)},
  ${sqlTimestamp(stripe.currentPeriodEnd)},
  'RESET_REQUIRED'::"MigratedSubscriberStatus",
  (SELECT "id" FROM user_row LIMIT 1),
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
  "status" = 'RESET_REQUIRED'::"MigratedSubscriberStatus",
  "flyhighUserId" = EXCLUDED."flyhighUserId",
  "updatedAt" = CURRENT_TIMESTAMP;
`.trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const uscreenCsv = await readFile(path.resolve(process.cwd(), options.uscreenFile), "utf8");
  const stripeCsv = await readFile(path.resolve(process.cwd(), options.stripeFile), "utf8");

  const uscreenRows = normalizeUscreenRows(parseCsv(uscreenCsv));
  const stripeRows = normalizeStripeRows(parseCsv(stripeCsv));
  const stripeByUserId = new Map(stripeRows.map((row) => [row.metadataUserId, row]));
  const limitedRows = options.limit ? uscreenRows.slice(0, options.limit) : uscreenRows;

  const statements: string[] = [];
  let matched = 0;
  let skipped = 0;

  for (const uscreen of limitedRows) {
    const stripe = stripeByUserId.get(uscreen.userId);
    if (!stripe) {
      skipped += 1;
      continue;
    }

    const statement = await buildStatement(uscreen, stripe);
    if (!statement) {
      skipped += 1;
      continue;
    }

    matched += 1;
    statements.push(statement);
  }

  const sql = [
    "-- Generated migrated subscriber import SQL",
    "-- Run this in Supabase SQL Editor after the migration SQL succeeds.",
    "BEGIN;",
    ...statements.map((statement) => `${statement}\n`),
    "COMMIT;"
  ].join("\n\n");

  await writeFile(options.outFile, sql, "utf8");
  console.log(`Generated SQL for ${matched} matched subscribers.`);
  console.log(`Skipped ${skipped} rows without a clean Stripe match.`);
  console.log(`Output written to ${options.outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
