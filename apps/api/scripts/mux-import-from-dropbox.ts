import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvRow = Record<string, string>;

type Options = {
  file: string;
  outCsv: string;
  outSql: string;
  concurrency: number;
  apply: boolean;
};

type ImportResult = {
  slug: string;
  title: string;
  sourceUrl: string;
  normalizedUrl: string;
  status: "ok" | "error" | "skipped";
  assetId: string;
  playbackId: string;
  error: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    outCsv: "prisma/migrations/_mux_import_results.csv",
    outSql: "prisma/migrations/_mux_media_update.sql",
    concurrency: 2,
    apply: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      options.file = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--out-csv") {
      options.outCsv = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--out-sql") {
      options.outSql = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (arg === "--concurrency") {
      const c = Number(argv[i + 1] ?? "");
      if (Number.isFinite(c) && c > 0) options.concurrency = Math.min(10, Math.floor(c));
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
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
    for (let i = 0; i < headers.length; i += 1) out[headers[i]] = (row[i] ?? "").trim();
    return out;
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getUrlFromRow(row: CsvRow): string {
  const keys = ["dropboxUrl", "sourceUrl", "url", "videoUrl"];
  for (const key of keys) {
    const value = (row[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function normalizeDropboxUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes("dropbox.com")) {
      u.searchParams.delete("raw");
      u.searchParams.set("dl", "1");
      return u.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

async function createMuxAsset(inputUrl: string, title: string): Promise<{ assetId: string; playbackId: string }> {
  const tokenId = process.env.MUX_TOKEN_ID?.trim() ?? "";
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim() ?? "";
  if (!tokenId || !tokenSecret) {
    throw new Error("Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET");
  }

  const basic = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  const response = await fetch("https://api.mux.com/video/v1/assets", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: [{ url: inputUrl }],
      playback_policy: ["public"],
      passthrough: title || undefined
    })
  });

  const json = (await response.json()) as {
    data?: { id?: string; playback_ids?: Array<{ id?: string }> };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json.error?.message || `Mux API error (${response.status})`);
  }

  const assetId = json.data?.id ?? "";
  const playbackId = json.data?.playback_ids?.[0]?.id ?? "";
  if (!assetId) throw new Error("Mux response missing asset id");
  return { assetId, playbackId };
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= items.length) break;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvRaw = await readFile(path.resolve(process.cwd(), options.file), "utf8");
  const rows = parseCsv(csvRaw);
  const results: ImportResult[] = new Array(rows.length);

  await runPool(rows, options.concurrency, async (row, index) => {
    const slug = (row["slug"] ?? "").trim();
    const title = (row["title"] ?? row["Title"] ?? "").trim();
    const sourceUrl = getUrlFromRow(row);
    const normalizedUrl = normalizeDropboxUrl(sourceUrl);

    if (!slug || !sourceUrl) {
      results[index] = {
        slug,
        title,
        sourceUrl,
        normalizedUrl,
        status: "skipped",
        assetId: "",
        playbackId: "",
        error: "Missing slug or source URL"
      };
      return;
    }

    if (!options.apply) {
      results[index] = {
        slug,
        title,
        sourceUrl,
        normalizedUrl,
        status: "skipped",
        assetId: "",
        playbackId: "",
        error: "Dry run only. Re-run with --apply"
      };
      return;
    }

    try {
      const mux = await createMuxAsset(normalizedUrl, title);
      results[index] = {
        slug,
        title,
        sourceUrl,
        normalizedUrl,
        status: "ok",
        assetId: mux.assetId,
        playbackId: mux.playbackId,
        error: ""
      };
    } catch (error) {
      results[index] = {
        slug,
        title,
        sourceUrl,
        normalizedUrl,
        status: "error",
        assetId: "",
        playbackId: "",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });

  const csvLines = [
    "slug,title,sourceUrl,normalizedUrl,status,assetId,playbackId,error",
    ...results.map((r) =>
      [
        r.slug,
        r.title,
        r.sourceUrl,
        r.normalizedUrl,
        r.status,
        r.assetId,
        r.playbackId,
        r.error
      ]
        .map(csvEscape)
        .join(",")
    )
  ];
  await writeFile(path.resolve(process.cwd(), options.outCsv), csvLines.join("\n"), "utf8");

  const sqlLines: string[] = [];
  sqlLines.push("-- Generated by scripts/mux-import-from-dropbox.ts");
  sqlLines.push("BEGIN;");
  let successCount = 0;
  for (const r of results) {
    if (r.status !== "ok" || !r.playbackId) continue;
    successCount += 1;
    sqlLines.push(
      `UPDATE "ContentItem" SET ` +
        `"playbackUrl"=${sqlText(`https://stream.mux.com/${r.playbackId}.m3u8`)},` +
        `"posterUrl"=${sqlText(`https://image.mux.com/${r.playbackId}/thumbnail.jpg?time=1`)},` +
        `"videoProvider"='mux',` +
        `"videoStatus"='ready',` +
        `"muxAssetId"=${sqlText(r.assetId)},` +
        `"muxPlaybackId"=${sqlText(r.playbackId)},` +
        `"updatedAt"=now() ` +
        `WHERE "slug"=${sqlText(r.slug)};`
    );
  }
  sqlLines.push("COMMIT;");
  sqlLines.push("");
  await writeFile(path.resolve(process.cwd(), options.outSql), sqlLines.join("\n"), "utf8");

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    error: results.filter((r) => r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    sqlUpdates: successCount,
    outCsv: path.resolve(process.cwd(), options.outCsv),
    outSql: path.resolve(process.cwd(), options.outSql)
  };
  console.log("Mux Dropbox import summary:", summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

