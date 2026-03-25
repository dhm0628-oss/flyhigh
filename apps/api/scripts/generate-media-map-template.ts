import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvRow = Record<string, string>;

function parseArgs(argv: string[]) {
  let inFile = "";
  let outFile = "prisma/migrations/_media_map_template.csv";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      inFile = (argv[i + 1] ?? "").trim();
      i += 1;
    } else if (arg === "--out") {
      outFile = (argv[i + 1] ?? "").trim();
      i += 1;
    }
  }
  if (!inFile) throw new Error("Missing required --file argument");
  return { inFile, outFile };
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
      if (currentRow.some((v) => v.length > 0)) rows.push(currentRow);
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
  return rows.slice(1).map((row) => {
    const out: CsvRow = {};
    for (let i = 0; i < headers.length; i += 1) out[headers[i]] = (row[i] ?? "").trim();
    return out;
  });
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
  let n = 2;
  while (used.has(next)) {
    next = `${base}-${n}`;
    n += 1;
  }
  used.add(next);
  return next;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

async function main() {
  const { inFile, outFile } = parseArgs(process.argv.slice(2));
  const raw = await readFile(path.resolve(process.cwd(), inFile), "utf8");
  const rows = parseCsv(raw);
  const used = new Set<string>();
  const lines = [
    "slug,title,source_id,author,duration_seconds,playbackUrl,posterUrl,heroPreviewUrl,notes"
  ];
  for (const row of rows) {
    const title = (row["Title"] ?? "").trim();
    if (!title) continue;
    const slug = makeUniqueSlug(slugify(title), used);
    const out = [
      slug,
      title,
      (row["ID"] ?? "").trim(),
      (row["Author"] ?? "").trim(),
      (row["Duration (Seconds)"] ?? "").trim(),
      "",
      "",
      "",
      ""
    ].map(csvEscape);
    lines.push(out.join(","));
  }
  const outPath = path.resolve(process.cwd(), outFile);
  await writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`Generated media map template at ${outPath} (${lines.length - 1} rows)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

