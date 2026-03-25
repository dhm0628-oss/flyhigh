import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvRow = Record<string, string>;

type Options = {
  file: string;
  out: string;
  limit: number | null;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    out: "prisma/migrations/_uscreen_tag_normalization.sql",
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
    if (arg === "--limit") {
      const raw = Number(argv[i + 1] ?? "");
      options.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
      i += 1;
      continue;
    }
  }

  if (!options.file) throw new Error("Missing required --file argument");
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

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(input: string): string {
  const noTags = input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(noTags).replace(/\s+/g, " ").trim();
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

function inferType(title: string): "FILM" | "EPISODE" | "TRAILER" {
  const t = title.toLowerCase();
  if (t.includes("trailer") || t.includes("teaser") || t.includes("hype")) return "TRAILER";
  if (t.includes("episode") || /\bep\s?\d+\b/.test(t)) return "EPISODE";
  return "FILM";
}

function inferTags(title: string, author: string, description: string): string[] {
  const tags = new Set<string>();
  const t = `${title} ${description}`.toLowerCase();
  const hasJetSki = t.includes("jetski") || t.includes("jet ski");

  // creator tag
  if (author.trim()) tags.add(slugify(author));

  // core taxonomy
  if (t.includes("wakeskate") || t.includes("wake skate")) tags.add("wakeskate");
  if (t.includes("wakesurf") || t.includes("wake surf") || t.includes("surfs")) tags.add("wakesurf");
  if ((t.includes("waterski") || t.includes("water ski") || /\bwatersk(i|ing)\b/.test(t) || /\bslalom\b/.test(t)) && !hasJetSki) {
    tags.add("waterski");
  }
  if (t.includes("cable") || t.includes("wake park") || t.includes("compound")) tags.add("cable");
  if (t.includes("boat") || t.includes("behind the boat")) tags.add("boat");
  if (t.includes("winch") || t.includes("winching")) tags.add("winch");
  if (t.includes("contest") || t.includes("competition") || t.includes("championship") || t.includes("league")) tags.add("competition");
  if (t.includes("instructional") || t.includes("how to") || t.includes("learn") || t.includes("coach")) tags.add("instructional");
  if (t.includes("documentary")) tags.add("documentary");
  if (t.includes("classic") || /(1998|2003|2004|2005|2006|2007)/.test(t)) tags.add("classic");
  if (t.includes("women") || t.includes("ladies") || t.includes("girl")) tags.add("womens");
  if (t.includes("muted") || t.includes("no audio") || t.includes("silent")) tags.add("muted");

  // entity tags
  if (t.includes("space mob")) tags.add("space-mob");
  if (t.includes("zuupack")) tags.add("zuupack");
  if (t.includes("outhouse")) tags.add("outhouse");
  if (t.includes("cadmium")) tags.add("cadmium-films");
  if (t.includes("bfy")) tags.add("bfy-action-films");

  // default sport tag if no modality already present
  if (!tags.has("wakeskate") && !tags.has("wakesurf") && !tags.has("waterski")) {
    tags.add("wakeboarding");
  }

  return [...tags].slice(0, 12);
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTextArray(values: string[]): string {
  if (!values.length) return "ARRAY[]::text[]";
  const escaped = values.map((v) => sqlText(v)).join(", ");
  return `ARRAY[${escaped}]::text[]`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvPath = path.resolve(process.cwd(), options.file);
  const outPath = path.resolve(process.cwd(), options.out);
  const raw = await readFile(csvPath, "utf8");
  const parsed = parseCsv(raw);
  const rows = options.limit ? parsed.slice(0, options.limit) : parsed;
  const usedSlugs = new Set<string>();

  const sql: string[] = [];
  sql.push("-- Generated by scripts/generate-uscreen-tag-normalization-sql.ts");
  sql.push("-- Updates tags + type by slug for imported Uscreen catalog");
  sql.push("BEGIN;");

  let updates = 0;
  for (const row of rows) {
    const title = row["Title"]?.trim() ?? "";
    if (!title) continue;

    const author = (row["Author"] ?? "").trim();
    const description = stripHtml(`${row["Short Description"] ?? ""} ${row["Description"] ?? ""}`);
    const slug = makeUniqueSlug(slugify(title), usedSlugs);
    const type = inferType(title);
    const tags = inferTags(title, author, description);

    sql.push(
      `UPDATE "ContentItem" SET "tags"=${sqlTextArray(tags)}, "type"=${sqlText(type)}::"ContentType", "updatedAt"=now() WHERE "slug"=${sqlText(slug)};`
    );
    updates += 1;
  }

  sql.push("COMMIT;");
  sql.push("");

  await writeFile(outPath, sql.join("\n"), "utf8");
  console.log(`Generated normalization SQL for ${updates} rows at ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
