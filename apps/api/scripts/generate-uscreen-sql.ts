import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

type CsvRow = Record<string, string>;

type Options = {
  file: string;
  out: string;
  publish: boolean;
  limit: number | null;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    out: "prisma/migrations/_uscreen_catalog_import.sql",
    publish: true,
    limit: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      options.file = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--out") {
      options.out = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--draft") {
      options.publish = false;
      continue;
    }
    if (arg === "--limit") {
      const raw = Number(argv[i + 1] ?? "");
      options.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
      i += 1;
      continue;
    }
  }

  if (!options.file) {
    throw new Error("Missing required --file argument");
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
  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1);

  return body.map((row) => {
    const out: CsvRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      out[headers[i]] = (row[i] ?? "").trim();
    }
    return out;
  });
}

function stripHtml(input: string): string {
  const noTags = input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(noTags).replace(/\s+/g, " ").trim();
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferYear(description: string, uploadedOn: string): number | null {
  const match = description.match(/\((19|20)\d{2}\)/);
  if (match) {
    const year = Number(match[0].replace(/[()]/g, ""));
    return Number.isFinite(year) ? year : null;
  }
  const date = new Date(uploadedOn);
  if (!Number.isNaN(date.getTime())) {
    return date.getUTCFullYear();
  }
  return null;
}

function inferType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("trailer") || t.includes("teaser") || t.includes("hype")) return "TRAILER";
  if (t.includes("episode") || /\bep\s?\d+\b/.test(t)) return "EPISODE";
  return "FILM";
}

function inferTags(title: string, author: string, description: string): string[] {
  const tags = new Set<string>();
  if (author) tags.add(author.toLowerCase());
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes("instructional") || text.includes("learn ") || text.includes("how to")) tags.add("instructional");
  if (text.includes("contest") || text.includes("competition")) tags.add("contest");
  if (text.includes("wakeskate")) tags.add("wakeskate");
  if (text.includes("cable")) tags.add("cable");
  if (text.includes("boat")) tags.add("boat");
  if (text.includes("classic") || text.includes("1998") || text.includes("2003") || text.includes("2004")) tags.add("classic");

  return [...tags].slice(0, 8);
}

function makeUniqueSlug(base: string, used: Set<string>): string {
  let next = base || "untitled";
  let counter = 2;
  while (used.has(next)) {
    next = `${base}-${counter}`;
    counter += 1;
  }
  used.add(next);
  return next;
}

function sqlText(value: string | null): string {
  if (value === null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlInt(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

function sqlTimestamp(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "NULL";
  return `'${date.toISOString()}'::timestamptz`;
}

function sqlTextArray(values: string[]): string {
  if (!values.length) return "ARRAY[]::text[]";
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `ARRAY[${escaped}]::text[]`;
}

function stableIdFromSlug(slug: string): string {
  // Keep IDs deterministic so reruns don't create new IDs for same slug.
  // 3 + 32 = 35 chars.
  return `usc${createHash("md5").update(slug).digest("hex")}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(process.cwd(), options.file);
  const outPath = path.resolve(process.cwd(), options.out);
  const raw = await readFile(csvPath, "utf8");
  const parsed = parseCsv(raw);
  const sourceRows = options.limit ? parsed.slice(0, options.limit) : parsed;
  const usedSlugs = new Set<string>();

  const statements: string[] = [];
  statements.push("-- Generated by scripts/generate-uscreen-sql.ts");
  statements.push("-- Safe to run in Supabase SQL Editor");
  statements.push("BEGIN;");

  let prepared = 0;
  for (const row of sourceRows) {
    const title = row["Title"]?.trim() ?? "";
    if (!title) continue;

    const shortDescription = stripHtml(row["Short Description"] ?? "");
    const longDescription = stripHtml(row["Description"] ?? "");
    const synopsis = longDescription || shortDescription || "No description yet.";
    const author = (row["Author"] ?? "").trim() || null;
    const uploadedOn = (row["Uploaded On"] ?? "").trim();
    const uploadedAt = new Date(uploadedOn);
    const durationRaw = Number(row["Duration (Seconds)"] ?? "0");
    const durationSeconds = Number.isFinite(durationRaw) ? Math.max(0, Math.floor(durationRaw)) : 0;
    const baseSlug = slugify(title);
    const slug = makeUniqueSlug(baseSlug, usedSlugs);
    const id = stableIdFromSlug(slug);
    const type = inferType(title);
    const releaseYear = inferYear(synopsis, uploadedOn);
    const tags = inferTags(title, author ?? "", synopsis);
    const publishStatus = options.publish ? "PUBLISHED" : "DRAFT";

    statements.push(
      `INSERT INTO "ContentItem" (` +
        `"id","slug","title","author","synopsis","type","posterUrl","durationSeconds","releaseYear","tags","isPremium","publishStatus","publishedAt","createdAt","updatedAt"` +
      `) VALUES (` +
        `${sqlText(id)},${sqlText(slug)},${sqlText(title)},${sqlText(author)},${sqlText(synopsis)},${sqlText(type)}::"ContentType",${sqlText("/home/hero-banner.jpg")},${durationSeconds},${sqlInt(releaseYear)},${sqlTextArray(tags)},true,${sqlText(publishStatus)}::"PublishStatus",${options.publish ? sqlTimestamp(uploadedAt) : "NULL"},${sqlTimestamp(uploadedAt)},now()` +
      `) ON CONFLICT ("slug") DO UPDATE SET ` +
        `"title"=EXCLUDED."title","author"=EXCLUDED."author","synopsis"=EXCLUDED."synopsis","type"=EXCLUDED."type","posterUrl"=EXCLUDED."posterUrl","durationSeconds"=EXCLUDED."durationSeconds","releaseYear"=EXCLUDED."releaseYear","tags"=EXCLUDED."tags","isPremium"=EXCLUDED."isPremium","publishStatus"=EXCLUDED."publishStatus","publishedAt"=EXCLUDED."publishedAt","createdAt"=COALESCE("ContentItem"."createdAt", EXCLUDED."createdAt"),"updatedAt"=now();`
    );
    prepared += 1;
  }

  statements.push("COMMIT;");
  statements.push("");

  await writeFile(outPath, statements.join("\n"), "utf8");
  console.log(`Generated SQL for ${prepared} rows at ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
