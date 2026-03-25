import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, ContentType, PublishStatus } from "@prisma/client";

type CsvRow = Record<string, string>;

type Options = {
  file: string;
  apply: boolean;
  publish: boolean;
  skipExisting: boolean;
  limit: number | null;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    apply: false,
    publish: false,
    skipExisting: false,
    limit: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      options.file = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--publish") {
      options.publish = true;
      continue;
    }
    if (arg === "--skip-existing") {
      options.skipExisting = true;
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

function inferType(title: string): ContentType {
  const t = title.toLowerCase();
  if (t.includes("trailer") || t.includes("teaser") || t.includes("hype")) return ContentType.TRAILER;
  if (t.includes("episode") || /\bep\s?\d+\b/.test(t)) return ContentType.EPISODE;
  return ContentType.FILM;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const csvPath = path.resolve(process.cwd(), options.file);
  const raw = await readFile(csvPath, "utf8");
  const parsed = parseCsv(raw);

  const sourceRows = options.limit ? parsed.slice(0, options.limit) : parsed;
  const usedSlugs = new Set<string>();
  const summary = {
    total: sourceRows.length,
    prepared: 0,
    created: 0,
    updated: 0,
    skippedExisting: 0,
    errors: 0
  };

  for (const row of sourceRows) {
    try {
      const title = row["Title"]?.trim() ?? "";
      if (!title) continue;

      const shortDescription = stripHtml(row["Short Description"] ?? "");
      const longDescription = stripHtml(row["Description"] ?? "");
      const synopsis = longDescription || shortDescription || "No description yet.";
      const author = (row["Author"] ?? "").trim() || null;
      const uploadedOn = (row["Uploaded On"] ?? "").trim();
      const uploadedAt = new Date(uploadedOn);
      const durationSecondsRaw = Number(row["Duration (Seconds)"] ?? "0");
      const durationSeconds = Number.isFinite(durationSecondsRaw) ? Math.max(0, Math.floor(durationSecondsRaw)) : 0;

      const baseSlug = slugify(title);
      const slug = makeUniqueSlug(baseSlug, usedSlugs);
      const type = inferType(title);
      const releaseYear = inferYear(synopsis, uploadedOn);
      const tags = inferTags(title, author ?? "", synopsis);

      summary.prepared += 1;

      if (!options.apply) continue;

      const existing = await prisma.contentItem.findUnique({ where: { slug }, select: { id: true } });
      if (existing && options.skipExisting) {
        summary.skippedExisting += 1;
        continue;
      }

      const data = {
        slug,
        title,
        author,
        synopsis,
        type,
        posterUrl: "/home/hero-banner.jpg",
        durationSeconds,
        releaseYear,
        tags,
        isPremium: true,
        publishStatus: options.publish ? PublishStatus.PUBLISHED : PublishStatus.DRAFT,
        publishedAt: options.publish ? (Number.isNaN(uploadedAt.getTime()) ? new Date() : uploadedAt) : null,
        createdAt: Number.isNaN(uploadedAt.getTime()) ? undefined : uploadedAt
      };

      if (existing) {
        await prisma.contentItem.update({
          where: { slug },
          data
        });
        summary.updated += 1;
      } else {
        await prisma.contentItem.create({ data });
        summary.created += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error("Row import error:", error);
    }
  }

  console.log("Uscreen import summary:", summary);
  if (!options.apply) {
    console.log("Dry run only. Re-run with --apply to write to DB.");
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

