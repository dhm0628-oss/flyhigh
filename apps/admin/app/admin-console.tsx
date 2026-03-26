"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Session = { authenticated: boolean; viewer: null | { displayName: string; email: string } };
type ContentItem = {
  id: string;
  slug: string;
  title: string;
  author?: string | null;
  synopsis?: string;
  type: string;
  publishStatus: string;
  isPremium: boolean;
  posterUrl?: string | null;
  heroPreviewUrl?: string | null;
  playbackUrl?: string | null;
  durationSeconds?: number;
  releaseYear?: number | null;
  tags?: string[];
  videoStatus?: string;
  videoProvider?: string | null;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
};
type Collection = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  sourceTag?: string | null;
  sourceLimit?: number;
  sortOrder: number;
  isPublic: boolean;
  isActive?: boolean;
  items: Array<{ slug: string; contentId: string }>;
};
type Plan = {
  id: string;
  code: string;
  name: string;
  interval: string;
  priceCents: number;
  priceUsd: number;
  currency: string;
  provider: string;
  providerPriceId?: string | null;
  isActive: boolean;
  updatedAt?: string;
};
type Coupon = {
  id: string;
  code: string;
  name: string;
  kind: "percent_off" | "amount_off" | "free_trial";
  duration: "once" | "repeating" | "forever";
  percentOff?: number | null;
  amountOffCents?: number | null;
  trialDays?: number | null;
  durationInMonths?: number | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive: boolean;
  redemptionCount: number;
};
type GiftCardProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amountCents: number;
  amountUsd: number;
  currency: string;
  durationMonths: number;
  stripePriceId?: string | null;
  plan: { id: string; code: string; name: string };
  isActive: boolean;
  purchaseCount: number;
  issuedCount: number;
  createdAt: string;
};
type GiftCard = {
  id: string;
  code: string;
  status: string;
  productName: string;
  durationMonths: number;
  purchaserName: string;
  purchaserEmail: string;
  recipientName?: string | null;
  recipientEmail: string;
  redeemedBy?: string | null;
  redeemedAt?: string | null;
  createdAt: string;
};
type GiftCardAnalytics = {
  totals: {
    purchaseCount: number;
    completedPurchaseCount: number;
    issuedCount: number;
    redeemedCount: number;
    revenueUsd: number;
  };
  byProduct: Array<{
    id: string;
    code: string;
    name: string;
    amountUsd: number;
    durationMonths: number;
    purchaseCount: number;
    issuedCount: number;
    revenueUsd: number;
  }>;
  recentPurchases: Array<{
    id: string;
    createdAt: string;
    purchaserName: string;
    recipientEmail: string;
    productName: string;
    amountUsd: number;
    status: string;
    code?: string | null;
    redeemedAt?: string | null;
  }>;
};
type WebhookLog = {
  id: string;
  provider: "stripe" | "mux";
  eventType: string;
  externalId?: string | null;
  status: "received" | "processed" | "failed";
  httpStatus?: number | null;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
};
type ReadinessReport = {
  ready: boolean;
  status: "pass" | "warn" | "fail";
  generatedAt: string;
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail";
    message: string;
  }>;
};
type PushDevice = {
  id: string;
  platform: string;
  provider: string;
  tokenLast4: string;
  isActive: boolean;
  deviceName: string;
  lastSeenAt: string;
  user: null | { id: string; email: string; displayName: string };
};
type PushCampaign = {
  id: string;
  title: string;
  message: string;
  target: string;
  deeplinkUrl?: string | null;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt?: string | null;
};
type Subscriber = { id: string; displayName: string; email: string; role: string; latestSubscription: null | { status: string; planName: string } };
type AnalyticsResponse = {
  windowDays: number;
  startDate: string;
  endDate: string;
  generatedAt: string;
  kpis: {
    publishedCount: number;
    draftCount: number;
    archivedCount: number;
    activeSubscribers: number;
    estimatedMrr: number;
    newUsers: number;
    watchEvents: number;
    watchHours: number;
    avgProgressPercent: number;
    completedViews: number;
    inProgressViews: number;
    myListAdds: number;
  };
  subscriptionStatusCounts: Record<string, number>;
  deviceStatusCounts: Record<string, number>;
  topWatched: Array<{
    contentId: string;
    title: string;
    slug: string;
    watchEvents: number;
    watchHours: number;
    avgProgressPercent: number;
  }>;
  topSaved: Array<{
    contentId: string;
    title: string;
    slug: string;
    saves: number;
  }>;
  recentWatchActivity: Array<{
    id: string;
    at: string;
    viewer: string;
    contentTitle: string;
    contentSlug: string;
    progressPercent: number;
    completed: boolean;
  }>;
  recentDeviceActivity: Array<{
    id: string;
    at: string;
    clientName: string;
    status: string;
    code: string;
  }>;
  trends: Array<{
    date: string;
    newUsers: number;
    cancellations: number;
    watchHours: number;
    myListAdds: number;
  }>;
  cohorts: Array<{
    cohortStart: string;
    signups: number;
    converted7d: number;
    conversionRate7d: number;
  }>;
};
type VideoAnalyticsResponse = {
  startDate: string;
  endDate: string;
  sortBy: "watchHours" | "watchEvents" | "avgProgressPercent";
  total: number;
  items: Array<{
    contentId: string;
    title: string;
    slug: string;
    author?: string | null;
    releaseYear?: number | null;
    durationSeconds: number;
    watchEvents: number;
    watchHours: number;
    avgProgressPercent: number;
  }>;
};
type DeviceAuthSession = {
  id: string;
  userCode: string;
  status: string;
  clientName: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  consumedAt: string | null;
  user: null | { id: string; email: string; displayName: string };
};
type BulkImportResult = {
  row: number;
  ok: boolean;
  contentId?: string;
  slug?: string;
  muxAssetId?: string;
  status?: string;
  sourceUrl?: string;
  error?: string;
};
type BulkImportRowPayload = {
  title: string;
  slug: string;
  sourceUrl: string;
  author: string;
  tags: string[];
  isPremium: boolean;
  publishStatus: string;
  type: string;
  synopsis: string;
  releaseYear?: number;
  durationSeconds?: number;
};
type BatchLocalUploadRow = {
  key: string;
  file: File;
  fileName: string;
  guessedSlug: string;
  contentId: string;
  status: "matched" | "unmatched" | "blocked_existing" | "uploading" | "processing" | "failed";
  progress: number;
  error?: string;
};

type CategoryCsvRow = {
  key: string;
  title: string;
  description: string;
  sourceTag: string;
  sourceLimit: number;
  sortOrder: number;
  isPublic: boolean;
  isActive: boolean;
  videoSlugs: string[];
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fileNameToSlug(fileName: string): string {
  return slugify(fileName.replace(/\.[^.]+$/, ""));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

async function uploadFileToMux(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    if (file.type) {
      xhr.setRequestHeader("Content-Type", file.type);
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onerror = () => reject(new Error("Mux upload failed"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`Mux upload failed (${xhr.status})`));
    };
    xhr.send(file);
  });
}

function getExistingVideoGuard(item: ContentItem | undefined): string | null {
  if (!item) return null;
  if (item.muxPlaybackId) return "Already has a ready Mux video";
  if (item.playbackUrl) return "Already has a playback URL";
  if (item.muxAssetId || ["upload_created", "processing", "ready"].includes(item.videoStatus ?? "")) {
    return "Already has a Mux upload or asset in progress";
  }
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      i += 1;
      continue;
    }
    if (ch === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseBulkCsvRows(text: string): {
  rows: BulkImportRowPayload[];
  preview: Array<{ row: number; title: string; slug: string; sourceUrl: string; publishStatus: string; type: string }>;
} {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const header = parsed[0].map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const sourceIdx = idx("dropbox_url") >= 0 ? idx("dropbox_url") : idx("source_url");
  if (sourceIdx < 0) {
    throw new Error("CSV must include dropbox_url or source_url column");
  }

  const rows: BulkImportRowPayload[] = [];
  const preview: Array<{ row: number; title: string; slug: string; sourceUrl: string; publishStatus: string; type: string }> = [];

  for (let i = 1; i < parsed.length; i += 1) {
    const r = parsed[i];
    const get = (name: string) => {
      const pos = idx(name);
      return pos >= 0 ? (r[pos] ?? "").trim() : "";
    };
    const sourceUrl = (r[sourceIdx] ?? "").trim();
    const title = get("title");
    const slug = get("slug") || slugify(title);
    const tags = get("tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const isPremiumRaw = get("is_premium").toLowerCase();
    const isPremium =
      isPremiumRaw === "true" || isPremiumRaw === "1" || isPremiumRaw === "yes"
        ? true
        : isPremiumRaw === "false" || isPremiumRaw === "0" || isPremiumRaw === "no"
          ? false
          : true;

    if (!sourceUrl || (!slug && !title)) {
      continue;
    }

    const rowPayload: BulkImportRowPayload = {
      title,
      slug,
      sourceUrl,
      author: get("author"),
      tags,
      isPremium,
      publishStatus: get("publish_status") || "draft",
      type: get("type") || "film",
      synopsis: get("synopsis"),
      releaseYear: get("release_year") ? Number(get("release_year")) : undefined,
      durationSeconds: get("duration_seconds") ? Number(get("duration_seconds")) : undefined
    };
    rows.push(rowPayload);
    preview.push({
      row: i + 1,
      title: rowPayload.title,
      slug: rowPayload.slug,
      sourceUrl: rowPayload.sourceUrl,
      publishStatus: rowPayload.publishStatus,
      type: rowPayload.type
    });
  }

  if (!rows.length) {
    throw new Error("No valid data rows found in CSV");
  }

  return { rows, preview };
}

function parseBooleanCell(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseCategoryCsvRows(text: string): CategoryCsvRow[] {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const keyIdx = idx("key");
  const titleIdx = idx("title");
  const videoSlugsIdx = idx("video_slugs");

  if (keyIdx < 0 || titleIdx < 0) {
    throw new Error("CSV must include key and title columns");
  }

  const rows: CategoryCsvRow[] = [];
  for (let i = 1; i < parsed.length; i += 1) {
    const row = parsed[i];
    const get = (name: string) => {
      const position = idx(name);
      return position >= 0 ? (row[position] ?? "").trim() : "";
    };

    const key = (row[keyIdx] ?? "").trim();
    const title = (row[titleIdx] ?? "").trim();
    if (!key || !title) continue;

    const rawSlugs = videoSlugsIdx >= 0 ? (row[videoSlugsIdx] ?? "").trim() : "";
    const videoSlugs = rawSlugs
      .split("|")
      .map((slug) => slug.trim())
      .filter(Boolean);

    rows.push({
      key,
      title,
      description: get("description"),
      sourceTag: get("source_tag"),
      sourceLimit: Math.max(1, Math.min(48, Number.parseInt(get("source_limit") || "24", 10) || 24)),
      sortOrder: Math.max(0, Number.parseInt(get("sort_order") || "0", 10) || 0),
      isPublic: parseBooleanCell(get("is_public"), true),
      isActive: parseBooleanCell(get("is_active"), true),
      videoSlugs
    });
  }

  if (!rows.length) {
    throw new Error("No valid category rows found in CSV");
  }

  return rows;
}

type TrendRow = AnalyticsResponse["trends"][number];

function TrendLineChart({ rows }: { rows: TrendRow[] }) {
  const width = 900;
  const height = 220;
  const padLeft = 44;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 28;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const maxY = Math.max(
    1,
    ...rows.map((r) => Math.max(r.newUsers, r.cancellations, r.watchHours, r.myListAdds))
  );

  function x(i: number) {
    if (rows.length <= 1) return padLeft;
    return padLeft + (i / (rows.length - 1)) * innerW;
  }

  function y(v: number) {
    return padTop + innerH - (v / maxY) * innerH;
  }

  function seriesPath(selector: (row: TrendRow) => number) {
    if (!rows.length) return "";
    return rows.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(selector(row))}`).join(" ");
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxY * p));

  return (
    <div className="chart-shell">
      <div className="chart-legend">
        <span><i style={{ background: "#0a7ea4" }} />New Users</span>
        <span><i style={{ background: "#b42318" }} />Cancellations</span>
        <span><i style={{ background: "#0f7b6c" }} />Watch Hours</span>
        <span><i style={{ background: "#7a4fd6" }} />My List Adds</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Daily trends chart">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padLeft} y1={y(tick)} x2={width - padRight} y2={y(tick)} className="chart-grid" />
            <text x={6} y={y(tick) + 4} className="chart-axis-label">{tick}</text>
          </g>
        ))}
        <path d={seriesPath((r) => r.newUsers)} stroke="#0a7ea4" fill="none" strokeWidth={2.5} />
        <path d={seriesPath((r) => r.cancellations)} stroke="#b42318" fill="none" strokeWidth={2.5} />
        <path d={seriesPath((r) => r.watchHours)} stroke="#0f7b6c" fill="none" strokeWidth={2.5} />
        <path d={seriesPath((r) => r.myListAdds)} stroke="#7a4fd6" fill="none" strokeWidth={2.5} />
        {rows.map((row, i) => (
          <text key={row.date} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {row.date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SimpleBarChart({
  rows,
  color
}: {
  rows: Array<{ label: string; value: number }>;
  color: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bar-chart">
      {rows.map((row) => {
        const widthPct = Math.max(2, Math.round((row.value / max) * 100));
        return (
          <div key={row.label} className="bar-row">
            <div className="bar-row__label">{row.label}</div>
            <div className="bar-row__track">
              <div className="bar-row__fill" style={{ width: `${widthPct}%`, background: color }} />
            </div>
            <div className="bar-row__value">{row.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function badgeClassForStatus(status: "pass" | "warn" | "fail") {
  if (status === "fail") return "badge badge-danger";
  if (status === "warn") return "badge badge-warn";
  return "badge badge-ok";
}

export function AdminConsole() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [tab, setTab] = useState<"analytics" | "content" | "categories" | "marketing" | "subscribers">("analytics");

  const [content, setContent] = useState<ContentItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [giftCardProducts, setGiftCardProducts] = useState<GiftCardProduct[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [giftCardAnalytics, setGiftCardAnalytics] = useState<GiftCardAnalytics | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [pushDevices, setPushDevices] = useState<PushDevice[]>([]);
  const [pushCampaigns, setPushCampaigns] = useState<PushCampaign[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() => toInputDate(shiftDays(new Date(), -29)));
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => toInputDate(new Date()));
  const [videoAnalytics, setVideoAnalytics] = useState<VideoAnalyticsResponse | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceAuthSession[]>([]);
  const [deviceStatusFilter, setDeviceStatusFilter] = useState("all");
  const [videoAnalyticsSortBy, setVideoAnalyticsSortBy] = useState<"watchHours" | "watchEvents" | "avgProgressPercent">("watchHours");
  const [videoAnalyticsQuery, setVideoAnalyticsQuery] = useState("");
  const [videoAnalyticsAuthor, setVideoAnalyticsAuthor] = useState("all");
  const [newPlan, setNewPlan] = useState({
    code: "",
    name: "",
    interval: "month",
    priceCents: 700,
    currency: "USD",
    providerPriceId: "",
    isActive: true
  });
  const [newPushCampaign, setNewPushCampaign] = useState({
    title: "",
    message: "",
    audience: "subscribers",
    deeplinkUrl: "",
    platform: "all"
  });
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    name: "",
    kind: "free_trial" as "percent_off" | "amount_off" | "free_trial",
    duration: "once" as "once" | "repeating" | "forever",
    percentOff: 20,
    amountOffCents: 200,
    trialDays: 14,
    durationInMonths: 3,
    maxRedemptions: 0,
    expiresAt: "",
    isActive: true
  });
  const [newGiftCardProduct, setNewGiftCardProduct] = useState({
    code: "",
    name: "",
    description: "",
    amountCents: 700,
    durationMonths: 1,
    stripePriceId: "",
    planCode: "",
    isActive: true
  });
  const [giftCardProductDrafts, setGiftCardProductDrafts] = useState<Record<string, {
    code: string;
    name: string;
    description: string;
    amountCents: number;
    currency: string;
    durationMonths: number;
    stripePriceId: string;
    planCode: string;
    isActive: boolean;
  }>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, {
    code: string;
    name: string;
    interval: string;
    priceCents: number;
    currency: string;
    providerPriceId: string;
    isActive: boolean;
  }>>({});
  const [collectionDrafts, setCollectionDrafts] = useState<Record<string, string[]>>({});
  const [collectionSlugInputDrafts, setCollectionSlugInputDrafts] = useState<Record<string, string>>({});
  const [collectionMetaDrafts, setCollectionMetaDrafts] = useState<
    Record<string, { title: string; description: string; sourceTag: string; sourceLimit: number; sortOrder: number; isPublic: boolean; isActive: boolean }>
  >({});
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Record<string, boolean>>({});

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [newContent, setNewContent] = useState({
    slug: "",
    title: "",
    author: "",
    type: "film",
    publishStatus: "draft",
    synopsis: "",
    posterUrl: "",
    heroPreviewUrl: "",
    playbackUrl: "",
    tagsCsv: "",
    durationSeconds: 0,
    releaseYear: new Date().getFullYear(),
    isPremium: true
  });

  const [newCollection, setNewCollection] = useState({ key: "", title: "", sourceTag: "", sourceLimit: 24, sortOrder: 0, isPublic: true });
  const [categoryCsvText, setCategoryCsvText] = useState("");
  const [categoryCsvFileName, setCategoryCsvFileName] = useState("");
  const [uploadContentId, setUploadContentId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [singleUploadProgress, setSingleUploadProgress] = useState(0);
  const [singleUploadPhase, setSingleUploadPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [importSourceUrl, setImportSourceUrl] = useState("");
  const [batchUploadRows, setBatchUploadRows] = useState<BatchLocalUploadRow[]>([]);
  const [batchUploadConcurrency, setBatchUploadConcurrency] = useState(2);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Array<{ row: number; title: string; slug: string; sourceUrl: string; publishStatus: string; type: string }>>([]);
  const [bulkLastSubmittedRows, setBulkLastSubmittedRows] = useState<BulkImportRowPayload[]>([]);
  const [bulkImportResults, setBulkImportResults] = useState<BulkImportResult[]>([]);
  const [posterUploadFile, setPosterUploadFile] = useState<File | null>(null);
  const [contentQuery, setContentQuery] = useState("");
  const [contentStatusFilter, setContentStatusFilter] = useState("all");
  const [contentMediaFilter, setContentMediaFilter] = useState("all");
  const [batchUploadFilter, setBatchUploadFilter] = useState("all");
  const [subscriberQuery, setSubscriberQuery] = useState("");
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState("all");
  const [editContentId, setEditContentId] = useState("");
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [dropCategoryId, setDropCategoryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState({
    slug: "",
    title: "",
    author: "",
    type: "film",
    publishStatus: "draft",
    synopsis: "",
    posterUrl: "",
    heroPreviewUrl: "",
    playbackUrl: "",
    tagsCsv: "",
    durationSeconds: 0,
    releaseYear: new Date().getFullYear(),
    isPremium: true
  });

  type AdminTab = "analytics" | "content" | "categories" | "marketing" | "subscribers";

  const publishedCount = useMemo(() => content.filter((c) => c.publishStatus === "published").length, [content]);
  const activeSubs = useMemo(() => subscribers.filter((s) => ["active", "trialing"].includes(s.latestSubscription?.status ?? "")).length, [subscribers]);
  const monthlyPlan = plans.find((p) => p.interval === "month");
  const estimatedMrr = (monthlyPlan?.priceUsd ?? 0) * activeSubs;
  const filteredSubscribers = useMemo(() => {
    const q = subscriberQuery.trim().toLowerCase();
    return subscribers.filter((s) => {
      const status = s.latestSubscription?.status ?? "none";
      if (subscriberStatusFilter !== "all" && status !== subscriberStatusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = `${s.displayName} ${s.email} ${status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [subscribers, subscriberQuery, subscriberStatusFilter]);
  const filteredContent = useMemo(() => {
    const q = contentQuery.trim().toLowerCase();
    return content.filter((item) => {
      if (contentStatusFilter !== "all" && item.publishStatus !== contentStatusFilter) return false;
      if (contentMediaFilter === "missing-playback" && (item.playbackUrl || item.muxPlaybackId)) return false;
      if (contentMediaFilter === "missing-poster" && item.posterUrl) return false;
      if (contentMediaFilter === "mux-processing" && item.videoStatus !== "processing" && item.videoStatus !== "upload_created") return false;
      if (contentMediaFilter === "mux-errored" && item.videoStatus !== "errored") return false;
      if (contentMediaFilter === "ready" && !item.muxPlaybackId && !item.playbackUrl) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.slug} ${item.synopsis ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      const hayWithAuthor = `${hay} ${item.author ?? ""}`.toLowerCase();
      return hayWithAuthor.includes(q);
    });
  }, [content, contentMediaFilter, contentQuery, contentStatusFilter]);
  const filteredBatchUploadRows = useMemo(() => {
    return batchUploadRows.filter((row) => {
      if (batchUploadFilter === "all") return true;
      if (batchUploadFilter === "matched") return row.status === "matched";
      if (batchUploadFilter === "unmatched") return !row.contentId || row.status === "unmatched";
      if (batchUploadFilter === "blocked") return row.status === "blocked_existing";
      if (batchUploadFilter === "uploading") return row.status === "uploading";
      if (batchUploadFilter === "processing") return row.status === "processing";
      if (batchUploadFilter === "failed") return row.status === "failed";
      return true;
    });
  }, [batchUploadFilter, batchUploadRows]);
  const contentBySlug = useMemo(
    () => new Map(content.map((item) => [item.slug, item])),
    [content]
  );
  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of content) {
      const a = item.author?.trim();
      if (a) set.add(a);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [content]);

  async function loadSessionAndData() {
    setLoading(true);
    setError(null);

    let s: Session;
    try {
      s = await api<Session>("/v1/auth/session", { method: "GET" });
    } catch (e) {
      setSession({ authenticated: false, viewer: null });
      setLoading(false);
      return;
    }

    setSession(s);

    if (!s.authenticated) {
      setLoading(false);
      return;
    }

    try {
      await loadAdminData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
      setNotice("Signed in, but some admin data did not load. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminData(targetTab: AdminTab = tab) {
    const baseResults = await Promise.allSettled([
      api<{ items: ContentItem[] }>("/v1/admin/content", { method: "GET" }),
      api<{ collections: Collection[] }>("/v1/admin/collections", { method: "GET" }),
      api<{ plans: Plan[] }>("/v1/admin/plans", { method: "GET" }),
      api<{ subscribers: Subscriber[] }>("/v1/admin/subscribers", { method: "GET" })
    ]);

    const [
      contentRes,
      collectionsRes,
      plansRes,
      subscribersRes
    ] = baseResults;

    const failures: string[] = [];
    const nextContent = contentRes.status === "fulfilled" ? contentRes.value.items : [];
    const nextCollections = collectionsRes.status === "fulfilled" ? collectionsRes.value.collections : [];

    if (contentRes.status === "fulfilled") {
      setContent(contentRes.value.items);
    } else {
      failures.push("content");
    }

    if (collectionsRes.status === "fulfilled") {
      setCollections(collectionsRes.value.collections);
      setCollectionDrafts(Object.fromEntries(collectionsRes.value.collections.map((r) => [r.id, r.items.map((i) => i.slug)])));
      setCollectionSlugInputDrafts(Object.fromEntries(collectionsRes.value.collections.map((r) => [r.id, ""])));
      setCollectionMetaDrafts(
        Object.fromEntries(
          collectionsRes.value.collections.map((r) => [
            r.id,
            {
              title: r.title ?? "",
              description: r.description ?? "",
              sourceTag: r.sourceTag ?? "",
              sourceLimit: r.sourceLimit ?? 24,
              sortOrder: r.sortOrder ?? 0,
              isPublic: r.isPublic ?? true,
              isActive: r.isActive ?? true
            }
          ])
        )
      );
      setCollapsedCategoryIds((current) =>
        Object.fromEntries(
          collectionsRes.value.collections.map((r, index) => [r.id, current[r.id] ?? index > 0])
        )
      );
    } else {
      failures.push("categories");
    }

    if (plansRes.status === "fulfilled") {
      setPlans(plansRes.value.plans);
      setNewGiftCardProduct((current) => ({
        ...current,
        planCode:
          current.planCode ||
          plansRes.value.plans.find((plan) => plan.isActive && plan.interval === "month")?.code ||
          plansRes.value.plans.find((plan) => plan.isActive)?.code ||
          plansRes.value.plans[0]?.code ||
          ""
      }));
      setPlanDrafts(
        Object.fromEntries(
          plansRes.value.plans.map((plan) => [
            plan.id,
            {
              code: plan.code,
              name: plan.name,
              interval: plan.interval,
              priceCents: plan.priceCents,
              currency: plan.currency,
              providerPriceId: plan.providerPriceId ?? "",
              isActive: plan.isActive
            }
          ])
        )
      );
    } else {
      failures.push("plans");
    }

    if (subscribersRes.status === "fulfilled") {
      setSubscribers(subscribersRes.value.subscribers);
    } else {
      failures.push("subscribers");
    }

    if (targetTab === "analytics") {
      const analyticsResults = await Promise.allSettled([
        api<ReadinessReport>("/v1/admin/readiness", { method: "GET" }),
        api<{ logs: WebhookLog[] }>("/v1/admin/webhooks?limit=40", { method: "GET" })
      ]);
      const [readinessRes, webhookLogsRes] = analyticsResults;

      if (readinessRes.status === "fulfilled") {
        setReadiness(readinessRes.value);
      } else {
        failures.push("readiness");
      }

      if (webhookLogsRes.status === "fulfilled") {
        setWebhookLogs(webhookLogsRes.value.logs);
      } else {
        failures.push("webhook logs");
      }

      try {
        await loadAnalytics({ startDate: analyticsStartDate, endDate: analyticsEndDate, days: analyticsDays });
      } catch {
        failures.push("analytics");
      }

      try {
        await loadDeviceSessions(deviceStatusFilter);
      } catch {
        failures.push("device sessions");
      }
    }

    if (targetTab === "marketing") {
      const marketingResults = await Promise.allSettled([
        api<{ coupons: Coupon[] }>("/v1/admin/coupons", { method: "GET" }),
        api<{ products: GiftCardProduct[] }>("/v1/admin/gift-card-products", { method: "GET" }),
        api<{ giftCards: GiftCard[] }>("/v1/admin/gift-cards", { method: "GET" }),
        api<GiftCardAnalytics>("/v1/admin/gift-cards/analytics", { method: "GET" }),
        api<{ devices: PushDevice[] }>("/v1/admin/marketing/push/devices?limit=200", { method: "GET" }),
        api<{ campaigns: PushCampaign[] }>("/v1/admin/marketing/push/campaigns", { method: "GET" })
      ]);
      const [
        couponsRes,
        giftCardProductsRes,
        giftCardsRes,
        giftCardAnalyticsRes,
        pushDevicesRes,
        pushCampaignsRes
      ] = marketingResults;

      if (couponsRes.status === "fulfilled") {
        setCoupons(couponsRes.value.coupons);
      } else {
        failures.push("coupons");
      }

      if (giftCardProductsRes.status === "fulfilled") {
        setGiftCardProducts(giftCardProductsRes.value.products);
        setGiftCardProductDrafts(
          Object.fromEntries(
            giftCardProductsRes.value.products.map((product) => [
              product.id,
              {
                code: product.code,
                name: product.name,
                description: product.description ?? "",
                amountCents: product.amountCents,
                currency: product.currency,
                durationMonths: product.durationMonths,
                stripePriceId: product.stripePriceId ?? "",
                planCode: product.plan.code,
                isActive: product.isActive
              }
            ])
          )
        );
      } else {
        failures.push("gift card products");
      }

      if (giftCardsRes.status === "fulfilled") {
        setGiftCards(giftCardsRes.value.giftCards);
      } else {
        failures.push("gift cards");
      }

      if (giftCardAnalyticsRes.status === "fulfilled") {
        setGiftCardAnalytics(giftCardAnalyticsRes.value);
      } else {
        failures.push("gift card analytics");
      }

      if (pushDevicesRes.status === "fulfilled") {
        setPushDevices(pushDevicesRes.value.devices);
      } else {
        failures.push("push devices");
      }

      if (pushCampaignsRes.status === "fulfilled") {
        setPushCampaigns(pushCampaignsRes.value.campaigns);
      } else {
        failures.push("push campaigns");
      }
    }

    if (editContentId) {
      const selected = nextContent.find((item) => item.id === editContentId);
      if (selected) {
        hydrateEditForm(selected);
        const selectedCategoryIds = nextCollections
          .filter((row) => row.items.some((entry) => entry.contentId === selected.id))
          .map((row) => row.id);
        setEditCategoryIds(selectedCategoryIds);
      }
    }

    if (failures.length) {
      setNotice(`Some admin sections did not load: ${failures.slice(0, 4).join(", ")}${failures.length > 4 ? ", ..." : ""}`);
    }
  }

  useEffect(() => {
    if (!session?.authenticated || loading) return;
    void loadAdminData(tab);
  }, [tab]);

  async function loadDeviceSessions(status: string) {
    const search = new URLSearchParams();
    if (status !== "all") search.set("status", status);
    search.set("limit", "100");
    const res = await api<{ sessions: DeviceAuthSession[] }>(`/v1/admin/device-auth/sessions?${search.toString()}`, { method: "GET" });
    setDeviceSessions(res.sessions);
  }

  async function loadAnalytics(params?: { days?: number; startDate?: string; endDate?: string }) {
    const search = new URLSearchParams();
    if (params?.days) search.set("days", String(params.days));
    if (params?.startDate) search.set("startDate", params.startDate);
    if (params?.endDate) search.set("endDate", params.endDate);
    const query = search.toString();

    setAnalyticsLoading(true);
    try {
      const data = await api<AnalyticsResponse>(`/v1/admin/analytics${query ? `?${query}` : ""}`, { method: "GET" });
      setAnalytics(data);
      setAnalyticsStartDate(data.startDate);
      setAnalyticsEndDate(data.endDate);
      await loadVideoAnalytics({
        startDate: data.startDate,
        endDate: data.endDate,
        sortBy: videoAnalyticsSortBy,
        q: videoAnalyticsQuery,
        author: videoAnalyticsAuthor
      });
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadVideoAnalytics(params: {
    startDate: string;
    endDate: string;
    sortBy: "watchHours" | "watchEvents" | "avgProgressPercent";
    q?: string;
    author?: string;
  }) {
    const search = new URLSearchParams();
    search.set("startDate", params.startDate);
    search.set("endDate", params.endDate);
    search.set("sortBy", params.sortBy);
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.author && params.author !== "all") search.set("author", params.author);
    const data = await api<VideoAnalyticsResponse>(`/v1/admin/analytics/videos?${search.toString()}`, { method: "GET" });
    setVideoAnalytics(data);
  }

  function hydrateEditForm(item: ContentItem) {
    setEditContent({
      slug: item.slug ?? "",
      title: item.title ?? "",
      author: item.author ?? "",
      type: item.type ?? "film",
      publishStatus: item.publishStatus ?? "draft",
      synopsis: item.synopsis ?? "",
      posterUrl: item.posterUrl ?? "",
      heroPreviewUrl: item.heroPreviewUrl ?? "",
      playbackUrl: item.playbackUrl ?? "",
      tagsCsv: (item.tags ?? []).join(", "),
      durationSeconds: item.durationSeconds ?? 0,
      releaseYear: item.releaseYear ?? new Date().getFullYear(),
      isPremium: item.isPremium ?? true
    });
  }

  useEffect(() => {
    void loadSessionAndData();
  }, []);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy("login");
    setError(null);
    try {
      await api("/v1/auth/login", { method: "POST", body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      await loadSessionAndData();
      setNotice("Logged in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(null);
    }
  }

  async function onLogout() {
    setBusy("logout");
    setError(null);
    try {
      await api("/v1/auth/logout", { method: "POST", body: JSON.stringify({}) });
      setSession({ authenticated: false, viewer: null });
      setNotice("Logged out");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSetSubscriberStatus(userId: string, status: "trialing" | "active" | "canceled") {
    const firstPlan = plans.find((p) => p.isActive && p.interval === "month") ?? plans.find((p) => p.isActive) ?? plans[0];
    if (!firstPlan) {
      setError("Create at least one plan first");
      return;
    }

    setBusy(`sub-${userId}-${status}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/subscribers/${userId}/subscriptions`, {
        method: "POST",
        body: JSON.stringify({ planCode: firstPlan.code, status })
      });
      await loadAdminData();
      setNotice(`Subscription updated to ${status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscriber status");
    } finally {
      setBusy(null);
    }
  }

  async function onDenyDeviceSession(sessionId: string) {
    setBusy(`deny-device-${sessionId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/device-auth/${sessionId}/deny`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadDeviceSessions(deviceStatusFilter);
      setNotice("Device session denied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deny device session");
    } finally {
      setBusy(null);
    }
  }

  async function onCreatePlan(e: FormEvent) {
    e.preventDefault();
    setBusy("create-plan");
    setError(null);
    setNotice(null);
    try {
      await api("/v1/admin/plans", {
        method: "POST",
        body: JSON.stringify({
          code: newPlan.code.trim(),
          name: newPlan.name.trim(),
          interval: newPlan.interval.trim().toLowerCase(),
          priceCents: Number(newPlan.priceCents),
          currency: newPlan.currency.trim().toUpperCase(),
          providerPriceId: newPlan.providerPriceId.trim() || null,
          isActive: newPlan.isActive
        })
      });
      setNewPlan({
        code: "",
        name: "",
        interval: "month",
        priceCents: 700,
        currency: "USD",
        providerPriceId: "",
        isActive: true
      });
      await loadAdminData();
      setNotice("Plan created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateCoupon(e: FormEvent) {
    e.preventDefault();
    setBusy("create-coupon");
    setError(null);
    setNotice(null);
    try {
      await api("/v1/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: newCoupon.code.trim().toUpperCase(),
          name: newCoupon.name.trim(),
          kind: newCoupon.kind,
          duration: newCoupon.duration,
          percentOff: newCoupon.kind === "percent_off" ? Number(newCoupon.percentOff) : undefined,
          amountOffCents: newCoupon.kind === "amount_off" ? Number(newCoupon.amountOffCents) : undefined,
          trialDays: newCoupon.kind === "free_trial" ? Number(newCoupon.trialDays) : undefined,
          durationInMonths: newCoupon.duration === "repeating" ? Number(newCoupon.durationInMonths) : undefined,
          maxRedemptions: Number(newCoupon.maxRedemptions) > 0 ? Number(newCoupon.maxRedemptions) : null,
          expiresAt: newCoupon.expiresAt ? new Date(newCoupon.expiresAt).toISOString() : null,
          isActive: newCoupon.isActive
        })
      });
      setNewCoupon({
        code: "",
        name: "",
        kind: "free_trial",
        duration: "once",
        percentOff: 20,
        amountOffCents: 200,
        trialDays: 14,
        durationInMonths: 3,
        maxRedemptions: 0,
        expiresAt: "",
        isActive: true
      });
      await loadAdminData();
      setNotice("Coupon created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateGiftCardProduct(e: FormEvent) {
    e.preventDefault();
    setBusy("create-gift-card-product");
    setError(null);
    setNotice(null);
    try {
      await api("/v1/admin/gift-card-products", {
        method: "POST",
        body: JSON.stringify({
          code: newGiftCardProduct.code.trim().toUpperCase(),
          name: newGiftCardProduct.name.trim(),
          description: newGiftCardProduct.description.trim() || null,
          amountCents: Number(newGiftCardProduct.amountCents),
          durationMonths: Number(newGiftCardProduct.durationMonths),
          stripePriceId: newGiftCardProduct.stripePriceId.trim(),
          planCode: newGiftCardProduct.planCode,
          isActive: newGiftCardProduct.isActive
        })
      });
      setNewGiftCardProduct((current) => ({
        code: "",
        name: "",
        description: "",
        amountCents: 700,
        durationMonths: 1,
        stripePriceId: "",
        planCode: current.planCode,
        isActive: true
      }));
      await loadAdminData();
      setNotice("Gift card product created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create gift card product");
    } finally {
      setBusy(null);
    }
  }

  async function onToggleGiftCardProduct(productId: string, isActive: boolean) {
    setBusy(`gift-card-product-${productId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/gift-card-products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      });
      await loadAdminData();
      setNotice(`Gift card product ${isActive ? "enabled" : "disabled"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update gift card product");
    } finally {
      setBusy(null);
    }
  }

  async function onSaveGiftCardProduct(productId: string) {
    const draft = giftCardProductDrafts[productId];
    if (!draft) return;

    setBusy(`save-gift-card-product-${productId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/gift-card-products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: draft.code.trim().toUpperCase(),
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          amountCents: Number(draft.amountCents),
          currency: draft.currency.trim().toUpperCase(),
          durationMonths: Number(draft.durationMonths),
          stripePriceId: draft.stripePriceId.trim(),
          planCode: draft.planCode,
          isActive: draft.isActive
        })
      });
      await loadAdminData();
      setNotice("Gift card product updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update gift card product");
    } finally {
      setBusy(null);
    }
  }

  async function onResendGiftCard(giftCardId: string) {
    setBusy(`gift-card-resend-${giftCardId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/gift-cards/${giftCardId}/resend`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setNotice("Gift card email resent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend gift card email");
    } finally {
      setBusy(null);
    }
  }

  async function onVoidGiftCard(giftCardId: string) {
    const confirmed = window.confirm("Void this gift card? This prevents future redemption.");
    if (!confirmed) return;

    setBusy(`gift-card-void-${giftCardId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/gift-cards/${giftCardId}/void`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadAdminData();
      setNotice("Gift card voided");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void gift card");
    } finally {
      setBusy(null);
    }
  }

  async function onSendPushCampaign(e: FormEvent) {
    e.preventDefault();
    setBusy("send-push");
    setError(null);
    setNotice(null);
    try {
      const res = await api<{
        ok: boolean;
        queued?: boolean;
        note?: string;
        matchedDevices?: number;
        sentCount?: number;
        failedCount?: number;
      }>("/v1/admin/marketing/push/send", {
        method: "POST",
        body: JSON.stringify({
          title: newPushCampaign.title.trim(),
          message: newPushCampaign.message.trim(),
          audience: newPushCampaign.audience,
          deeplinkUrl: newPushCampaign.deeplinkUrl.trim() || null,
          platform: newPushCampaign.platform
        })
      });
      await loadAdminData();
      setNotice(
        res.queued
          ? `Campaign queued for ${res.matchedDevices ?? 0} devices. ${res.note ?? ""}`.trim()
          : `Push sent: ${res.sentCount ?? 0} success, ${res.failedCount ?? 0} failed`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send push campaign");
    } finally {
      setBusy(null);
    }
  }

  async function onToggleCoupon(couponId: string, nextActive: boolean) {
    setBusy(`coupon-${couponId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/coupons/${couponId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive })
      });
      await loadAdminData();
      setNotice(nextActive ? "Coupon activated" : "Coupon deactivated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update coupon");
    } finally {
      setBusy(null);
    }
  }

  async function onSavePlan(planId: string) {
    const draft = planDrafts[planId];
    if (!draft) return;
    setBusy(`save-plan-${planId}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: draft.code.trim(),
          name: draft.name.trim(),
          interval: draft.interval.trim().toLowerCase(),
          priceCents: Number(draft.priceCents),
          currency: draft.currency.trim().toUpperCase(),
          providerPriceId: draft.providerPriceId.trim() || null,
          isActive: draft.isActive
        })
      });
      await loadAdminData();
      setNotice("Plan updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan");
    } finally {
      setBusy(null);
    }
  }

  async function applyAnalyticsDateRange() {
    setError(null);
    setNotice(null);
    if (!analyticsStartDate || !analyticsEndDate) {
      setError("Select both start and end dates");
      return;
    }
    if (analyticsEndDate < analyticsStartDate) {
      setError("End date must be on or after start date");
      return;
    }
    try {
      await loadAnalytics({ startDate: analyticsStartDate, endDate: analyticsEndDate });
      setNotice("Analytics date range updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    }
  }

  async function applyQuickAnalyticsRange(days: number) {
    const end = new Date();
    const start = shiftDays(end, -(days - 1));
    const startDate = toInputDate(start);
    const endDate = toInputDate(end);
    setAnalyticsDays(days);
    setAnalyticsStartDate(startDate);
    setAnalyticsEndDate(endDate);
    try {
      await loadAnalytics({ days, startDate, endDate });
      setNotice(`Analytics set to last ${days} days`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    }
  }

  function exportSubscribersCsv() {
    const rows = filteredSubscribers.map((s) => ({
      name: s.displayName,
      email: s.email,
      role: s.role,
      subscription_status: s.latestSubscription?.status ?? "none",
      plan: s.latestSubscription?.planName ?? ""
    }));
    if (!rows.length) {
      setNotice("No subscriber rows to export");
      return;
    }
    exportCsv(`subscribers-${toInputDate(new Date())}.csv`, rows);
    setNotice("Subscribers CSV exported");
  }

  function exportCouponsCsv() {
    const rows = coupons.map((c) => ({
      code: c.code,
      name: c.name,
      kind: c.kind,
      duration: c.duration,
      percent_off: c.percentOff ?? "",
      amount_off_cents: c.amountOffCents ?? "",
      trial_days: c.trialDays ?? "",
      max_redemptions: c.maxRedemptions ?? "",
      redemptions: c.redemptionCount,
      expires_at: c.expiresAt ?? "",
      is_active: c.isActive
    }));
    if (!rows.length) {
      setNotice("No coupon rows to export");
      return;
    }
    exportCsv(`coupons-${toInputDate(new Date())}.csv`, rows);
    setNotice("Coupons CSV exported");
  }

  function exportAnalyticsSummaryCsv() {
    if (!analytics) {
      setNotice("No analytics data to export");
      return;
    }
    const rows: Array<Record<string, unknown>> = [
      {
        start_date: analytics.startDate,
        end_date: analytics.endDate,
        window_days: analytics.windowDays,
        published_titles: analytics.kpis.publishedCount,
        active_subscribers: analytics.kpis.activeSubscribers,
        estimated_mrr: analytics.kpis.estimatedMrr,
        watch_hours: analytics.kpis.watchHours,
        watch_events: analytics.kpis.watchEvents,
        avg_completion_percent: analytics.kpis.avgProgressPercent,
        new_users: analytics.kpis.newUsers,
        completed_views: analytics.kpis.completedViews,
        in_progress_views: analytics.kpis.inProgressViews,
        my_list_adds: analytics.kpis.myListAdds
      }
    ];
    exportCsv(`analytics-summary-${analytics.startDate}-to-${analytics.endDate}.csv`, rows);
    setNotice("Analytics summary CSV exported");
  }

  function exportAnalyticsTrendsCsv() {
    if (!analytics?.trends?.length) {
      setNotice("No trend rows to export");
      return;
    }
    exportCsv(`analytics-trends-${analytics.startDate}-to-${analytics.endDate}.csv`, analytics.trends);
    setNotice("Analytics trend CSV exported");
  }

  function exportTopContentCsv() {
    if (!analytics) {
      setNotice("No analytics data to export");
      return;
    }
    const watchedRows = analytics.topWatched.map((item) => ({
      type: "top_watched",
      title: item.title,
      slug: item.slug,
      watch_events: item.watchEvents,
      watch_hours: item.watchHours,
      avg_progress_percent: item.avgProgressPercent,
      saves: ""
    }));
    const savedRows = analytics.topSaved.map((item) => ({
      type: "top_saved",
      title: item.title,
      slug: item.slug,
      watch_events: "",
      watch_hours: "",
      avg_progress_percent: "",
      saves: item.saves
    }));
    const rows = [...watchedRows, ...savedRows];
    if (!rows.length) {
      setNotice("No top content rows to export");
      return;
    }
    exportCsv(`top-content-${analytics.startDate}-to-${analytics.endDate}.csv`, rows);
    setNotice("Top content CSV exported");
  }

  async function applyVideoAnalyticsFilters() {
    if (!analyticsStartDate || !analyticsEndDate) {
      setError("Select analytics date range first");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await loadVideoAnalytics({
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
        sortBy: videoAnalyticsSortBy,
        q: videoAnalyticsQuery,
        author: videoAnalyticsAuthor
      });
      setNotice("Video analytics updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load video analytics");
    }
  }

  function exportVideoAnalyticsCsv() {
    if (!videoAnalytics?.items?.length) {
      setNotice("No video analytics rows to export");
      return;
    }
    exportCsv(
      `video-analytics-${videoAnalytics.startDate}-to-${videoAnalytics.endDate}.csv`,
      videoAnalytics.items.map((item) => ({
        title: item.title,
        slug: item.slug,
        author: item.author ?? "",
        release_year: item.releaseYear ?? "",
        duration_seconds: item.durationSeconds,
        watch_events: item.watchEvents,
        watch_hours: item.watchHours,
        avg_progress_percent: item.avgProgressPercent
      }))
    );
    setNotice("Video analytics CSV exported");
  }

  function exportContentCsv() {
    if (!content.length) {
      setNotice("No content rows to export");
      return;
    }

    exportCsv(
      `content-catalog-${toInputDate(new Date())}.csv`,
      content.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        author: item.author ?? "",
        type: item.type,
        publish_status: item.publishStatus,
        is_premium: item.isPremium,
        synopsis: item.synopsis ?? "",
        poster_url: item.posterUrl ?? "",
        hero_preview_url: item.heroPreviewUrl ?? "",
        playback_url: item.playbackUrl ?? "",
        duration_seconds: item.durationSeconds ?? 0,
        release_year: item.releaseYear ?? "",
        tags: (item.tags ?? []).join(", "),
        video_status: item.videoStatus ?? "",
        video_provider: item.videoProvider ?? "",
        mux_asset_id: item.muxAssetId ?? "",
        mux_playback_id: item.muxPlaybackId ?? ""
      }))
    );
    setNotice("Content CSV exported");
  }

  async function onBackfillPremiumPreviews() {
    setBusy("backfill-premium-previews");
    setError(null);
    setNotice(null);
    try {
      const res = await api<{
        total: number;
        queued: number;
        failed: number;
      }>("/v1/admin/content/backfill-premium-previews", {
        method: "POST",
        body: JSON.stringify({ limit: 100 })
      });
      await loadAdminData();
      setNotice(
        `Premium preview backfill queued ${res.queued} teaser clip${res.queued === 1 ? "" : "s"}${res.failed ? `, ${res.failed} failed` : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to backfill premium previews");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateContent(e: FormEvent) {
    e.preventDefault();
    setBusy("create-content");
    setError(null);
    try {
      await api("/v1/admin/content", {
        method: "POST",
        body: JSON.stringify({
          ...newContent,
          author: newContent.author || null,
          heroPreviewUrl: newContent.heroPreviewUrl || null,
          playbackUrl: newContent.playbackUrl || null,
          tags: newContent.tagsCsv.split(",").map((t) => t.trim()).filter(Boolean)
        })
      });
      setNewContent((v) => ({ ...v, slug: "", title: "", author: "", synopsis: "", posterUrl: "", heroPreviewUrl: "", playbackUrl: "", tagsCsv: "" }));
      await loadAdminData();
      setNotice("Content created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create content failed");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(id: string, publishStatus: string) {
    setBusy(`status-${id}`);
    setError(null);
    try {
      await api(`/v1/admin/content/${id}`, { method: "PATCH", body: JSON.stringify({ publishStatus }) });
      await loadAdminData();
      setNotice(`Set status to ${publishStatus}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateCollection(e: FormEvent) {
    e.preventDefault();
    setBusy("create-collection");
    setError(null);
    try {
      await api("/v1/admin/collections", { method: "POST", body: JSON.stringify(newCollection) });
      setNewCollection({ key: "", title: "", sourceTag: "", sourceLimit: 24, sortOrder: 0, isPublic: true });
      await loadAdminData();
      setNotice("Collection created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create collection failed");
    } finally {
      setBusy(null);
    }
  }

  function exportCategoriesCsv() {
    const rows = [...collections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => {
        const meta = collectionMetaDrafts[row.id] ?? {
          title: row.title,
          description: row.description ?? "",
          sourceTag: row.sourceTag ?? "",
          sourceLimit: row.sourceLimit ?? 24,
          sortOrder: row.sortOrder,
          isPublic: row.isPublic,
          isActive: row.isActive ?? true
        };
        const videoSlugs = (collectionDrafts[row.id] ?? row.items.map((item) => item.slug)).join("|");
        return {
          key: row.key,
          title: meta.title,
          description: meta.description,
          source_tag: meta.sourceTag,
          source_limit: meta.sourceLimit,
          sort_order: meta.sortOrder,
          is_public: meta.isPublic,
          is_active: meta.isActive,
          video_slugs: videoSlugs
        };
      });

    exportCsv("flyhigh-categories.csv", rows);
    setNotice(`Exported ${rows.length} categories`);
    setError(null);
  }

  function downloadCategoryCsvTemplate() {
    exportCsv("flyhigh-categories-template.csv", [
      {
        key: "space-mob",
        title: "Space Mob",
        description: "Space Mob films and edits",
        source_tag: "space-mob",
        source_limit: 24,
        sort_order: 1,
        is_public: true,
        is_active: true,
        video_slugs: "space-cadets|yardsale-6-team-video-live-reveal"
      },
      {
        key: "classics",
        title: "Classics",
        description: "Foundational wake films",
        source_tag: "",
        source_limit: 24,
        sort_order: 2,
        is_public: true,
        is_active: true,
        video_slugs: "exit-69|flying-high-fluid"
      }
    ]);
    setNotice("Downloaded category CSV template");
    setError(null);
  }

  async function onCategoryCsvFileSelected(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      parseCategoryCsvRows(text);
      setCategoryCsvText(text);
      setCategoryCsvFileName(file.name);
      setNotice(`Loaded category CSV: ${file.name}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read category CSV");
    }
  }

  async function onImportCategoriesCsv() {
    let rows: CategoryCsvRow[];
    try {
      rows = parseCategoryCsvRows(categoryCsvText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid category CSV");
      return;
    }

    const slugToId = new Map(content.map((item) => [item.slug, item.id]));
    const sanitizedRows = rows.map((row) => {
      const keptSlugs = row.videoSlugs.filter((slug) => slugToId.has(slug));
      const ignoredSlugs = row.videoSlugs.filter((slug) => !slugToId.has(slug));
      return {
        ...row,
        videoSlugs: keptSlugs,
        ignoredSlugs
      };
    });

    setBusy("import-categories-csv");
    setError(null);
    setNotice(null);

    try {
      let ignoredCount = 0;
      const ignoredByCategory: string[] = [];

      for (const row of sanitizedRows) {
        const existing = collections.find((collection) => collection.key === row.key);
        const payload = {
          title: row.title,
          description: row.description || null,
          sourceTag: row.sourceTag || null,
          sourceLimit: row.sourceLimit,
          sortOrder: row.sortOrder,
          isPublic: row.isPublic,
          isActive: row.isActive
        };

        if (row.ignoredSlugs.length) {
          ignoredCount += row.ignoredSlugs.length;
          ignoredByCategory.push(`${row.key}: ${row.ignoredSlugs.join(", ")}`);
        }

        let collectionId = existing?.id ?? "";
        if (!existing) {
          const created = await api<{ id: string; key: string }>("/v1/admin/collections", {
            method: "POST",
            body: JSON.stringify({
              key: row.key,
              ...payload
            })
          });
          collectionId = created.id;
        }

        await api(`/v1/admin/collections/${collectionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...payload,
            items: row.videoSlugs.map((slug, index) => ({
              contentId: slugToId.get(slug),
              sortOrder: index + 1
            }))
          })
        });
      }

      await loadAdminData();
      setNotice(
        ignoredCount
          ? `Imported ${rows.length} categories from CSV. Ignored ${ignoredCount} unknown slugs. ${ignoredByCategory.slice(0, 3).join(" | ")}${ignoredByCategory.length > 3 ? " | ..." : ""}`
          : `Imported ${rows.length} categories from CSV`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Category CSV import failed");
    } finally {
      setBusy(null);
    }
  }

  async function onUploadVideo(e: FormEvent) {
    e.preventDefault();
    if (!uploadContentId || !uploadFile) {
      setError("Choose a content item and a video file");
      return;
    }

    setBusy("mux-upload");
    setError(null);
    setNotice(null);
    setSingleUploadProgress(0);
    setSingleUploadPhase("uploading");

    try {
      const upload = await api<{ uploadUrl: string; uploadId: string; provider: string }>(
        `/v1/admin/content/${uploadContentId}/video-upload`,
        { method: "POST", body: JSON.stringify({}) }
      );

      await uploadFileToMux(upload.uploadUrl, uploadFile, (progress) => {
        setSingleUploadProgress(progress);
      });

      setSingleUploadPhase("processing");
      setNotice("Upload complete. Mux is processing the video now.");
      setUploadFile(null);
      setSingleUploadProgress(100);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onImportVideoFromUrl() {
    if (!uploadContentId || !importSourceUrl.trim()) {
      setError("Choose a content item and paste a Dropbox/video URL");
      return;
    }

    setBusy("mux-import-url");
    setError(null);
    setNotice(null);

    try {
      await api<{ muxAssetId: string; status: string }>(
        `/v1/admin/content/${uploadContentId}/video-import-url`,
        { method: "POST", body: JSON.stringify({ sourceUrl: importSourceUrl.trim() }) }
      );

      setNotice("Import started. Mux is processing the source URL now.");
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video import failed");
    } finally {
      setBusy(null);
    }
  }

  async function onBatchFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;

    const nextRows = Array.from(fileList).map((file, index) => {
      const guessedSlug = fileNameToSlug(file.name);
      const match = contentBySlug.get(guessedSlug);
      const existingVideoGuard = getExistingVideoGuard(match);
      return {
        key: `${file.name}-${file.size}-${index}`,
        file,
        fileName: file.name,
        guessedSlug,
        contentId: match?.id ?? "",
        status: match ? (existingVideoGuard ? "blocked_existing" : "matched") : "unmatched",
        progress: 0,
        error: existingVideoGuard ?? undefined
      } satisfies BatchLocalUploadRow;
    });

    setBatchUploadRows(nextRows);
    setError(null);
    setNotice(`Loaded ${nextRows.length} local files for batch upload`);
  }

  function updateBatchUploadRow(key: string, patch: Partial<BatchLocalUploadRow>) {
    setBatchUploadRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function setBatchUploadContent(key: string, contentId: string) {
    setBatchUploadRows((current) =>
      current.map((row) =>
        row.key === key
          ? (() => {
              const item = content.find((entry) => entry.id === contentId);
              const existingVideoGuard = getExistingVideoGuard(item);
              return {
                ...row,
                contentId,
                status: contentId ? (existingVideoGuard ? "blocked_existing" : "matched") : "unmatched",
                error: existingVideoGuard ?? undefined
              };
            })()
          : row
      )
    );
  }

  async function onStartBatchLocalUpload() {
    const queuedRows = batchUploadRows.filter((row) => row.contentId && row.status === "matched");
    if (!queuedRows.length) {
      setError("Load local files and match them to content items that do not already have video");
      return;
    }

    setBusy("mux-batch-upload");
    setError(null);
    setNotice(null);

    let completed = 0;
    let failed = 0;
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(4, Number(batchUploadConcurrency) || 1));

    const runNext = async () => {
      while (cursor < queuedRows.length) {
        const row = queuedRows[cursor];
        cursor += 1;

        try {
          updateBatchUploadRow(row.key, {
            status: "uploading",
            progress: 0,
            error: undefined
          });

          const upload = await api<{ uploadUrl: string; uploadId: string; provider: string }>(
            `/v1/admin/content/${row.contentId}/video-upload`,
            { method: "POST", body: JSON.stringify({}) }
          );

          await uploadFileToMux(upload.uploadUrl, row.file, (progress) => {
            updateBatchUploadRow(row.key, { progress });
          });

          updateBatchUploadRow(row.key, {
            status: "processing",
            progress: 100
          });
          completed += 1;
        } catch (err) {
          failed += 1;
          updateBatchUploadRow(row.key, {
            status: "failed",
            error: err instanceof Error ? err.message : "Upload failed"
          });
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: workerCount }, () => runNext()));
      await loadAdminData();
      setNotice(
        `Batch upload finished. ${completed} sent to Mux for processing${failed ? `, ${failed} failed` : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setBusy(null);
    }
  }

  function downloadBulkImportTemplate() {
    const rows = [
      "title,slug,dropbox_url,author,tags,is_premium,publish_status,type,synopsis,release_year,duration_seconds",
      "Wake Film 1,wake-film-1,https://www.dropbox.com/scl/fi/xxxx/video1.mp4?dl=0,Flyhigh,\"wakeboard,featured\",true,draft,film,\"Great film\",2026,3600"
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flyhigh-bulk-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function onBulkImportFromCsv() {
    let rows: BulkImportRowPayload[];
    let previewRows: Array<{ row: number; title: string; slug: string; sourceUrl: string; publishStatus: string; type: string }>;
    try {
      const parsed = parseBulkCsvRows(bulkCsvText);
      rows = parsed.rows;
      previewRows = parsed.preview;
      setBulkPreviewRows(previewRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid CSV");
      return;
    }

    setBusy("bulk-import");
    setError(null);
    setNotice(null);
    try {
      const res = await api<{
        total: number;
        successCount: number;
        failedCount: number;
        results: BulkImportResult[];
      }>("/v1/admin/content/bulk-import-url", {
        method: "POST",
        body: JSON.stringify({ rows })
      });
      setBulkLastSubmittedRows(rows);
      setBulkImportResults(res.results);
      setNotice(`Bulk import complete: ${res.successCount} succeeded, ${res.failedCount} failed`);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setBusy(null);
    }
  }

  async function onBulkCsvFileSelected(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      setBulkCsvText(text);
      setBulkCsvFileName(file.name);
      const parsed = parseBulkCsvRows(text);
      setBulkPreviewRows(parsed.preview);
      setNotice(`Loaded ${parsed.rows.length} rows from ${file.name}`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read CSV file");
    }
  }

  function onPreviewBulkCsv() {
    try {
      const parsed = parseBulkCsvRows(bulkCsvText);
      setBulkPreviewRows(parsed.preview);
      setNotice(`Parsed ${parsed.rows.length} rows`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid CSV");
    }
  }

  async function onRetryFailedBulkImport() {
    const failedRows = bulkImportResults
      .filter((result) => !result.ok)
      .map((result) => bulkLastSubmittedRows[result.row - 1])
      .filter((row): row is BulkImportRowPayload => Boolean(row));

    if (!failedRows.length) {
      setNotice("No failed rows to retry");
      return;
    }

    setBusy("bulk-import-retry");
    setError(null);
    setNotice(null);
    try {
      const res = await api<{
        total: number;
        successCount: number;
        failedCount: number;
        results: BulkImportResult[];
      }>("/v1/admin/content/bulk-import-url", {
        method: "POST",
        body: JSON.stringify({ rows: failedRows })
      });
      setBulkLastSubmittedRows(failedRows);
      setBulkImportResults(res.results);
      setNotice(`Retry complete: ${res.successCount} succeeded, ${res.failedCount} failed`);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  function selectForEdit(item: ContentItem) {
    setEditContentId(item.id);
    hydrateEditForm(item);
    setUploadContentId(item.id);
    const selectedCategoryIds = collections
      .filter((row) => row.items.some((entry) => entry.contentId === item.id))
      .map((row) => row.id);
    setEditCategoryIds(selectedCategoryIds);
    setNotice(`Editing ${item.title}`);
    setError(null);
  }

  async function onSaveEditContent(e: FormEvent) {
    e.preventDefault();
    if (!editContentId) {
      setError("Select a content item to edit");
      return;
    }

    setBusy("save-edit-content");
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/content/${editContentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editContent,
          author: editContent.author || null,
          heroPreviewUrl: editContent.heroPreviewUrl || null,
          playbackUrl: editContent.playbackUrl || null,
          tags: editContent.tagsCsv.split(",").map((t) => t.trim()).filter(Boolean)
        })
      });
      await loadAdminData();
      setNotice("Content updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function onUploadPoster() {
    if (!editContentId || !posterUploadFile) {
      setError("Select a content item and choose an image file");
      return;
    }

    setBusy("poster-upload");
    setError(null);
    setNotice(null);
    try {
      const dataBase64 = await fileToBase64(posterUploadFile);
      const result = await api<{ ok: true; posterUrl: string }>(`/v1/admin/content/${editContentId}/poster-upload`, {
        method: "POST",
        body: JSON.stringify({
          filename: posterUploadFile.name,
          mimeType: posterUploadFile.type || "application/octet-stream",
          dataBase64
        })
      });
      setEditContent((current) => ({ ...current, posterUrl: result.posterUrl }));
      setPosterUploadFile(null);
      await loadAdminData();
      setNotice("Poster uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Poster upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteContent(id: string) {
    const item = content.find((c) => c.id === id);
    const confirmed = window.confirm(`Delete content "${item?.title ?? id}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusy(`delete-${id}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/content/${id}`, { method: "DELETE" });
      if (editContentId === id) {
        setEditContentId("");
      }
      if (uploadContentId === id) {
        setUploadContentId("");
      }
      await loadAdminData();
      setNotice("Content deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteCollection(id: string) {
    const row = collections.find((entry) => entry.id === id);
    const confirmed = window.confirm(`Delete category "${row?.title ?? id}"? This cannot be undone.`);
    if (!confirmed) return;

    setBusy(`delete-collection-${id}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/collections/${id}`, { method: "DELETE" });
      await loadAdminData();
      setNotice("Category deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete category failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveCollectionItems(row: Collection) {
    const meta = collectionMetaDrafts[row.id] ?? {
      title: row.title,
      description: row.description ?? "",
      sourceTag: row.sourceTag ?? "",
      sourceLimit: row.sourceLimit ?? 24,
      sortOrder: row.sortOrder,
      isPublic: row.isPublic,
      isActive: row.isActive ?? true
    };
    const slugToId = new Map(content.map((c) => [c.slug, c.id]));
    const slugs = (collectionDrafts[row.id] ?? []).map((s) => s.trim()).filter(Boolean);
    const missing = slugs.filter((s) => !slugToId.has(s));
    if (missing.length) {
      setError(`Unknown slugs: ${missing.join(", ")}`);
      return;
    }
    setBusy(`row-${row.id}`);
    setError(null);
    try {
      await api(`/v1/admin/collections/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: meta.title,
          description: meta.description || null,
          sourceTag: meta.sourceTag || null,
          sourceLimit: meta.sourceLimit,
          sortOrder: meta.sortOrder,
          isPublic: meta.isPublic,
          isActive: meta.isActive,
          items: slugs.map((slug, i) => ({ contentId: slugToId.get(slug), sortOrder: i + 1 }))
        })
      });
      await loadAdminData();
      setNotice(`Saved ${meta.title || row.title}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save row failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSaveContentCategories() {
    if (!editContentId) {
      setError("Select a content item to assign categories");
      return;
    }
    setBusy("save-content-categories");
    setError(null);
    setNotice(null);
    try {
      await api(`/v1/admin/content/${editContentId}/categories`, {
        method: "PUT",
        body: JSON.stringify({ collectionIds: editCategoryIds })
      });
      await loadAdminData();
      setNotice("Video categories updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save categories");
    } finally {
      setBusy(null);
    }
  }

  async function moveCategory(rowId: string, direction: "up" | "down") {
    const ordered = [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((row) => row.id === rowId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const copy = [...ordered];
    const tmp = copy[index];
    copy[index] = copy[nextIndex];
    copy[nextIndex] = tmp;
    const orderedIds = copy.map((row) => row.id);
    await persistCategoryOrder(orderedIds, "Category order updated");
  }

  async function persistCategoryOrder(orderedIds: string[], successMessage: string) {
    setBusy("reorder-categories");
    setError(null);
    setNotice(null);
    try {
      await api("/v1/admin/categories/reorder", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds })
      });
      await loadAdminData();
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder categories");
    } finally {
      setBusy(null);
    }
  }

  async function onDropCategory(targetRowId: string) {
    if (!dragCategoryId || dragCategoryId === targetRowId) {
      setDropCategoryId(null);
      return;
    }

    const ordered = [...collections].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id);
    const from = ordered.indexOf(dragCategoryId);
    const to = ordered.indexOf(targetRowId);
    if (from < 0 || to < 0) {
      setDropCategoryId(null);
      return;
    }

    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setDropCategoryId(null);
    setDragCategoryId(null);
    await persistCategoryOrder(next, "Category order updated (drag and drop)");
  }

  function toggleCategoryCollapsed(collectionId: string) {
    setCollapsedCategoryIds((current) => ({
      ...current,
      [collectionId]: !current[collectionId]
    }));
  }

  function setAllCategoriesCollapsed(collapsed: boolean) {
    setCollapsedCategoryIds(
      Object.fromEntries(collections.map((row) => [row.id, collapsed]))
    );
  }

  function updateCollectionMetaDraft(
    collectionId: string,
    patch: Partial<{ title: string; description: string; sourceTag: string; sourceLimit: number; sortOrder: number; isPublic: boolean; isActive: boolean }>
  ) {
    setCollectionMetaDrafts((current) => {
      const existing = current[collectionId] ?? {
        title: "",
        description: "",
        sourceTag: "",
        sourceLimit: 24,
        sortOrder: 0,
        isPublic: true,
        isActive: true
      };
      return {
        ...current,
        [collectionId]: {
          ...existing,
          ...patch
        }
      };
    });
  }

  function addCollectionSlug(collectionId: string) {
    const nextSlug = (collectionSlugInputDrafts[collectionId] ?? "").trim();
    if (!nextSlug) return;

    const exists = content.some((item) => item.slug === nextSlug);
    if (!exists) {
      setError(`Unknown slug: ${nextSlug}`);
      return;
    }

    setCollectionDrafts((current) => {
      const existing = current[collectionId] ?? [];
      if (existing.includes(nextSlug)) return current;
      return { ...current, [collectionId]: [...existing, nextSlug] };
    });
    setCollectionSlugInputDrafts((current) => ({ ...current, [collectionId]: "" }));
    setError(null);
  }

  function moveCollectionSlug(collectionId: string, slug: string, direction: "up" | "down") {
    setCollectionDrafts((current) => {
      const existing = [...(current[collectionId] ?? [])];
      const index = existing.indexOf(slug);
      if (index < 0) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= existing.length) return current;
      const [moved] = existing.splice(index, 1);
      existing.splice(nextIndex, 0, moved);
      return { ...current, [collectionId]: existing };
    });
  }

  function removeCollectionSlug(collectionId: string, slug: string) {
    setCollectionDrafts((current) => ({
      ...current,
      [collectionId]: (current[collectionId] ?? []).filter((entry) => entry !== slug)
    }));
  }

  if (loading) return <main className="admin-shell"><div className="panel"><strong>Loading admin...</strong></div></main>;

  if (!session?.authenticated) {
    return (
      <main className="admin-shell">
        <section className="login-panel">
          <div className="eyebrow">Flyhigh.tv Admin</div>
          <h1>Sign in</h1>
          <p>Use the seeded admin account to start managing content and rows.</p>
          <form className="form-grid" onSubmit={onLogin}>
            <label>Email<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></label>
            <label>Password
              <div className="password-field">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-inline password-field__toggle"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowLoginPassword((current) => !current)}
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className="btn btn-primary" disabled={busy === "login"}>{busy === "login" ? "Signing in..." : "Sign in"}</button>
          </form>
          {error ? <p className="status status-error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <h1>Flyhigh.tv Admin</h1>
        <p className="sidebar-user">{session.viewer?.displayName}</p>
        <nav>
          <button className={`nav-link ${tab === "analytics" ? "is-active" : ""}`} onClick={() => setTab("analytics")}>Analytics</button>
          <button className={`nav-link ${tab === "content" ? "is-active" : ""}`} onClick={() => setTab("content")}>Content</button>
          <button className={`nav-link ${tab === "categories" ? "is-active" : ""}`} onClick={() => setTab("categories")}>Categories</button>
          <button className={`nav-link ${tab === "marketing" ? "is-active" : ""}`} onClick={() => setTab("marketing")}>Marketing</button>
          <button className={`nav-link ${tab === "subscribers" ? "is-active" : ""}`} onClick={() => setTab("subscribers")}>Subscribers</button>
        </nav>
        <div className="sidebar-actions">
          <button className="btn btn-secondary" onClick={() => void loadAdminData()}>Refresh</button>
          <button className="btn btn-ghost" onClick={() => void onLogout()}>{busy === "logout" ? "Signing out..." : "Sign out"}</button>
        </div>
      </aside>
      <section className="main">
        <div className="topbar"><strong>Control Plane</strong><p style={{ margin: "0.5rem 0 0", color: "var(--muted)" }}>Live data from your API and Supabase.</p></div>
        <div className="grid">
          <div className="card"><div className="label">Published titles</div><div className="value">{analytics?.kpis.publishedCount ?? publishedCount}</div></div>
          <div className="card"><div className="label">Active subscribers</div><div className="value">{analytics?.kpis.activeSubscribers ?? activeSubs}</div></div>
          <div className="card"><div className="label">Plans</div><div className="value">{plans.length}</div></div>
          <div className="card"><div className="label">Est. MRR</div><div className="value">${(analytics?.kpis.estimatedMrr ?? estimatedMrr).toFixed(2)}</div></div>
        </div>
        {error ? <p className="status status-error">{error}</p> : null}
        {notice ? <p className="status status-ok">{notice}</p> : null}

        {tab === "analytics" ? (
          <>
            <div className="card">
              <div className="row__header">
                <h2 className="section-title">Deployment Readiness</h2>
                <span className={badgeClassForStatus(readiness?.status ?? "warn")}>
                  {readiness?.status ?? "unknown"}
                </span>
              </div>
              <div className="label" style={{ marginTop: "0.5rem" }}>
                {readiness ? `Generated ${new Date(readiness.generatedAt).toLocaleString()}` : "Readiness data unavailable"}
              </div>
              <div className="table" style={{ marginTop: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(readiness?.checks ?? []).map((check) => (
                      <tr key={check.key}>
                        <td>{check.label}</td>
                        <td>
                          <span className={badgeClassForStatus(check.status)}>
                            {check.status}
                          </span>
                        </td>
                        <td>{check.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="row__header">
                <h2 className="section-title">Recent Webhook Events</h2>
                <div className="label">Stripe and Mux delivery log</div>
              </div>
              <div className="table" style={{ marginTop: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Provider</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>HTTP</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                        <td>{log.provider}</td>
                        <td>
                          {log.eventType}
                          {log.externalId ? <div className="label">{log.externalId}</div> : null}
                        </td>
                        <td><span className={badgeClassForStatus(log.status === "failed" ? "fail" : log.status === "processed" ? "pass" : "warn")}>{log.status}</span></td>
                        <td>{log.httpStatus ?? "-"}</td>
                        <td>{log.errorMessage || (log.processedAt ? `processed ${new Date(log.processedAt).toLocaleString()}` : "-")}</td>
                      </tr>
                    ))}
                    {webhookLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="label">No webhook events logged yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Analytics Window</h2>
              <div className="row-actions" style={{ marginTop: "0.75rem" }}>
                <button className="btn-inline" onClick={() => void applyQuickAnalyticsRange(7)}>Last 7 Days</button>
                <button className="btn-inline" onClick={() => void applyQuickAnalyticsRange(30)}>Last 30 Days</button>
                <button className="btn-inline" onClick={() => void applyQuickAnalyticsRange(90)}>Last 90 Days</button>
                <label>
                  Start
                  <input type="date" value={analyticsStartDate} onChange={(e) => setAnalyticsStartDate(e.target.value)} />
                </label>
                <label>
                  End
                  <input type="date" value={analyticsEndDate} onChange={(e) => setAnalyticsEndDate(e.target.value)} />
                </label>
                <button
                  className="btn btn-primary"
                  onClick={() => void applyAnalyticsDateRange()}
                  disabled={analyticsLoading}
                >
                  {analyticsLoading ? "Loading..." : "Apply Date Range"}
                </button>
                <button className="btn btn-secondary" onClick={exportAnalyticsSummaryCsv}>Export Summary CSV</button>
                <button className="btn btn-secondary" onClick={exportAnalyticsTrendsCsv}>Export Trends CSV</button>
                <button className="btn btn-secondary" onClick={exportTopContentCsv}>Export Top Content CSV</button>
                <div className="label" style={{ alignSelf: "center" }}>
                  Range: {analytics?.startDate ?? analyticsStartDate} to {analytics?.endDate ?? analyticsEndDate} | Generated: {analytics ? new Date(analytics.generatedAt).toLocaleString() : "n/a"}
                </div>
              </div>
            </div>

            <div className="grid">
              <div className="card"><div className="label">Watch hours</div><div className="value">{analytics?.kpis.watchHours ?? 0}</div></div>
              <div className="card"><div className="label">Watch events</div><div className="value">{analytics?.kpis.watchEvents ?? 0}</div></div>
              <div className="card"><div className="label">Avg completion</div><div className="value">{analytics?.kpis.avgProgressPercent ?? 0}%</div></div>
              <div className="card"><div className="label">New users</div><div className="value">{analytics?.kpis.newUsers ?? 0}</div></div>
              <div className="card"><div className="label">My List adds</div><div className="value">{analytics?.kpis.myListAdds ?? 0}</div></div>
              <div className="card"><div className="label">Completed views</div><div className="value">{analytics?.kpis.completedViews ?? 0}</div></div>
            </div>

            <div className="grid">
              <div className="card">
                <h2 className="section-title">Top Watched Content</h2>
                <div style={{ marginTop: "0.75rem" }}>
                  <SimpleBarChart
                    rows={(analytics?.topWatched ?? []).map((item) => ({ label: item.title, value: item.watchEvents }))}
                    color="#0a7ea4"
                  />
                </div>
                <div className="list-compact" style={{ marginTop: "0.75rem" }}>
                  {(analytics?.topWatched ?? []).map((item) => (
                    <div key={item.contentId} className="list-row">
                      <strong>{item.title}</strong>
                      <div className="label">{item.watchEvents} events | {item.watchHours}h | {item.avgProgressPercent}% avg</div>
                    </div>
                  ))}
                  {analytics?.topWatched?.length === 0 ? <div className="label">No watch data in this window yet.</div> : null}
                </div>
              </div>

              <div className="card">
                <h2 className="section-title">Most Saved To My List</h2>
                <div className="list-compact" style={{ marginTop: "0.75rem" }}>
                  {(analytics?.topSaved ?? []).map((item) => (
                    <div key={item.contentId} className="list-row">
                      <strong>{item.title}</strong>
                      <div className="label">{item.saves} saves</div>
                    </div>
                  ))}
                  {analytics?.topSaved?.length === 0 ? <div className="label">No save data yet.</div> : null}
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Video Watch Analytics</h2>
              <div className="form-grid" style={{ marginTop: "0.75rem", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                <label>
                  Sort by
                  <select value={videoAnalyticsSortBy} onChange={(e) => setVideoAnalyticsSortBy(e.target.value as typeof videoAnalyticsSortBy)}>
                    <option value="watchHours">Watch time (hours)</option>
                    <option value="watchEvents">Watch events</option>
                    <option value="avgProgressPercent">Avg completion %</option>
                  </select>
                </label>
                <label>
                  Search
                  <input value={videoAnalyticsQuery} onChange={(e) => setVideoAnalyticsQuery(e.target.value)} placeholder="Title or author" />
                </label>
                <label>
                  Author
                  <select value={videoAnalyticsAuthor} onChange={(e) => setVideoAnalyticsAuthor(e.target.value)}>
                    <option value="all">All authors</option>
                    {authorOptions.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <div className="row-actions" style={{ alignItems: "end" }}>
                  <button className="btn btn-primary" onClick={() => void applyVideoAnalyticsFilters()}>Apply</button>
                  <button className="btn btn-secondary" onClick={exportVideoAnalyticsCsv}>Export CSV</button>
                </div>
              </div>
              <div className="table" style={{ marginTop: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Watch Hours</th>
                      <th>Watch Events</th>
                      <th>Avg Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(videoAnalytics?.items ?? []).map((item) => (
                      <tr key={item.contentId}>
                        <td>{item.title}</td>
                        <td>{item.author ?? "n/a"}</td>
                        <td>{item.watchHours}</td>
                        <td>{item.watchEvents}</td>
                        <td>{item.avgProgressPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid">
              <div className="card">
                <h2 className="section-title">Subscription Status Mix</h2>
                <div className="chips" style={{ marginTop: "0.75rem" }}>
                  {Object.entries(analytics?.subscriptionStatusCounts ?? {}).map(([status, count]) => (
                    <span className="badge" key={status}>{status}: {count}</span>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="section-title">Device Login Status</h2>
                <div className="chips" style={{ marginTop: "0.75rem" }}>
                  {Object.entries(analytics?.deviceStatusCounts ?? {}).map(([status, count]) => (
                    <span className="badge" key={status}>{status}: {count}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid">
              <div className="card">
                <h2 className="section-title">Recent Watch Activity</h2>
                <div className="list-compact" style={{ marginTop: "0.75rem" }}>
                  {(analytics?.recentWatchActivity ?? []).map((item) => (
                    <div className="list-row" key={item.id}>
                      <strong>{item.viewer} - {item.contentTitle}</strong>
                      <div className="label">{new Date(item.at).toLocaleString()} | {item.progressPercent}% {item.completed ? "(completed)" : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="section-title">Recent Device Activity</h2>
                <div className="list-compact" style={{ marginTop: "0.75rem" }}>
                  {(analytics?.recentDeviceActivity ?? []).map((item) => (
                    <div className="list-row" key={item.id}>
                      <strong>{item.clientName} - {item.status}</strong>
                      <div className="label">{new Date(item.at).toLocaleString()} | code {item.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="row__header">
                <h2 className="section-title">Device Login Sessions</h2>
                <div className="row-actions">
                  <select value={deviceStatusFilter} onChange={(e) => setDeviceStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="consumed">Consumed</option>
                    <option value="expired">Expired</option>
                    <option value="denied">Denied</option>
                  </select>
                  <button className="btn btn-secondary" onClick={() => void loadDeviceSessions(deviceStatusFilter)}>Refresh</button>
                </div>
              </div>
              <div className="table" style={{ marginTop: "0.75rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Client</th>
                      <th>User</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceSessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.userCode}</td>
                        <td>{session.status}</td>
                        <td>{session.clientName}</td>
                        <td>{session.user ? `${session.user.displayName} (${session.user.email})` : "n/a"}</td>
                        <td>{new Date(session.createdAt).toLocaleString()}</td>
                        <td>{new Date(session.expiresAt).toLocaleString()}</td>
                        <td>
                          <div className="row-actions">
                            {(session.status === "pending" || session.status === "approved") ? (
                              <button
                                className="btn-inline danger"
                                onClick={() => void onDenyDeviceSession(session.id)}
                                disabled={busy === `deny-device-${session.id}`}
                              >
                                {busy === `deny-device-${session.id}` ? "Denying..." : "Deny"}
                              </button>
                            ) : (
                              <span className="label">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid">
              <div className="card">
                <h2 className="section-title">Daily Trends</h2>
                <div style={{ marginTop: "0.75rem" }}>
                  <TrendLineChart rows={analytics?.trends ?? []} />
                </div>
                <div className="table" style={{ marginTop: "0.75rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>New Users</th>
                        <th>Cancellations</th>
                        <th>Watch Hours</th>
                        <th>My List Adds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.trends ?? []).map((row) => (
                        <tr key={row.date}>
                          <td>{row.date}</td>
                          <td>{row.newUsers}</td>
                          <td>{row.cancellations}</td>
                          <td>{row.watchHours}</td>
                          <td>{row.myListAdds}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card">
                <h2 className="section-title">Cohort Conversion (7-Day)</h2>
                <div style={{ marginTop: "0.75rem" }}>
                  <SimpleBarChart
                    rows={(analytics?.cohorts ?? []).map((row) => ({
                      label: row.cohortStart,
                      value: Number(row.conversionRate7d)
                    }))}
                    color="#7a4fd6"
                  />
                </div>
                <div className="table" style={{ marginTop: "0.75rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Cohort Week</th>
                        <th>Signups</th>
                        <th>Converted (7d)</th>
                        <th>Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.cohorts ?? []).map((row) => (
                        <tr key={row.cohortStart}>
                          <td>{row.cohortStart}</td>
                          <td>{row.signups}</td>
                          <td>{row.converted7d}</td>
                          <td>{row.conversionRate7d}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {tab === "content" ? (
          <>
            <div className="card">
              <h2 className="section-title">Create Content</h2>
              <form className="form-grid two-col" onSubmit={onCreateContent}>
                <label>Slug<input value={newContent.slug} onChange={(e) => setNewContent({ ...newContent, slug: slugify(e.target.value) })} /></label>
                <label>Title<input value={newContent.title} onChange={(e) => setNewContent((current) => {
                  const nextTitle = e.target.value;
                  const autoPrev = slugify(current.title);
                  const shouldAutoUpdateSlug = !current.slug || current.slug === autoPrev;
                  return {
                    ...current,
                    title: nextTitle,
                    slug: shouldAutoUpdateSlug ? slugify(nextTitle) : current.slug
                  };
                })} /></label>
                <label>Author<input value={newContent.author} onChange={(e) => setNewContent({ ...newContent, author: e.target.value })} placeholder="e.g. Flyhigh Originals" /></label>
                <label>Type<select value={newContent.type} onChange={(e) => setNewContent({ ...newContent, type: e.target.value })}><option value="film">Film</option><option value="series">Series</option><option value="episode">Episode</option><option value="trailer">Trailer</option><option value="bonus">Bonus</option></select></label>
                <label>Status<select value={newContent.publishStatus} onChange={(e) => setNewContent({ ...newContent, publishStatus: e.target.value })}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <label>Duration (sec)<input type="number" min={0} value={newContent.durationSeconds} onChange={(e) => setNewContent({ ...newContent, durationSeconds: Number(e.target.value) })} /></label>
                <label>Release Year<input type="number" value={newContent.releaseYear} onChange={(e) => setNewContent({ ...newContent, releaseYear: Number(e.target.value) })} /></label>
                <label className="span-2">Poster URL<input value={newContent.posterUrl} onChange={(e) => setNewContent({ ...newContent, posterUrl: e.target.value })} /></label>
                <label className="span-2">Hero Preview URL (HLS)<input value={newContent.heroPreviewUrl} onChange={(e) => setNewContent({ ...newContent, heroPreviewUrl: e.target.value })} /></label>
                <label className="span-2">Playback URL<input value={newContent.playbackUrl} onChange={(e) => setNewContent({ ...newContent, playbackUrl: e.target.value })} /></label>
                <label className="span-2">Tags CSV<input value={newContent.tagsCsv} onChange={(e) => setNewContent({ ...newContent, tagsCsv: e.target.value })} placeholder="wakeboard, featured" /></label>
                <label className="span-2">Synopsis<textarea rows={3} value={newContent.synopsis} onChange={(e) => setNewContent({ ...newContent, synopsis: e.target.value })} /></label>
                <label className="checkbox"><input type="checkbox" checked={newContent.isPremium} onChange={(e) => setNewContent({ ...newContent, isPremium: e.target.checked })} />Subscriber only</label>
                <div className="span-2"><button className="btn btn-primary" disabled={busy === "create-content"}>{busy === "create-content" ? "Creating..." : "Create Content"}</button></div>
              </form>
            </div>

            <div className="card">
              <h2 className="section-title">Upload Video To Mux</h2>
              <form className="form-grid two-col" onSubmit={onUploadVideo}>
                <label className="span-2">
                  Content item
                  <select value={uploadContentId} onChange={(e) => setUploadContentId(e.target.value)}>
                    <option value="">Select content...</option>
                    {content.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.slug})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  Video file
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="span-2">
                  Dropbox / video URL
                  <input
                    value={importSourceUrl}
                    onChange={(e) => setImportSourceUrl(e.target.value)}
                    placeholder="https://www.dropbox.com/scl/fi/.../video.mp4?dl=0"
                  />
                </label>
                <div className="span-2">
                  <button className="btn btn-primary" disabled={busy === "mux-upload"}>
                    {busy === "mux-upload" ? "Uploading..." : "Upload To Mux"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginLeft: "0.6rem" }}
                    disabled={busy === "mux-import-url"}
                    onClick={() => void onImportVideoFromUrl()}
                  >
                    {busy === "mux-import-url" ? "Importing..." : "Import From URL"}
                  </button>
                  {busy === "mux-upload" ? (
                    <>
                      <div className="label" style={{ marginTop: "0.6rem" }}>
                        {singleUploadPhase === "uploading"
                          ? `Uploading file: ${singleUploadProgress}%`
                          : "File uploaded. Waiting for Mux processing webhook..."}
                      </div>
                      {singleUploadPhase === "processing" ? (
                        <div className="label" style={{ marginTop: "0.25rem" }}>
                          You can leave this page open and refresh later to see the content item move to ready.
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="card">
              <div className="row__header">
                <h2 className="section-title">Batch Upload Local Files To Mux</h2>
                <div className="row-actions">
                  <label>
                    Show
                    <select
                      value={batchUploadFilter}
                      onChange={(e) => setBatchUploadFilter(e.target.value)}
                      style={{ marginLeft: "0.5rem", marginRight: "0.75rem" }}
                    >
                      <option value="all">All</option>
                      <option value="unmatched">Unmatched</option>
                      <option value="matched">Matched</option>
                      <option value="blocked">Already has video</option>
                      <option value="uploading">Uploading</option>
                      <option value="processing">Processing</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                  <label>
                    Concurrency
                    <select
                      value={batchUploadConcurrency}
                      onChange={(e) => setBatchUploadConcurrency(Number(e.target.value))}
                      style={{ marginLeft: "0.5rem" }}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="label" style={{ marginTop: "0.5rem" }}>
                Files are matched by slugified filename first. You can override the match before starting the queue.
              </div>
              <div className="form-grid two-col" style={{ marginTop: "0.75rem" }}>
                <label className="span-2">
                  Local video files
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={(e) => void onBatchFilesSelected(e.target.files)}
                  />
                </label>
                <div className="span-2 row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === "mux-batch-upload" || !batchUploadRows.some((row) => row.status === "matched")}
                    onClick={() => void onStartBatchLocalUpload()}
                  >
                    {busy === "mux-batch-upload" ? "Uploading..." : "Start Batch Upload"}
                  </button>
                </div>
              </div>
              {batchUploadRows.length ? (
                <div className="table" style={{ marginTop: "0.75rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Guessed Slug</th>
                        <th>Content Match</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatchUploadRows.map((row) => {
                        const matchedItem = content.find((item) => item.id === row.contentId);
                        return (
                          <tr key={row.key}>
                            <td>{row.fileName}</td>
                            <td>{row.guessedSlug || "-"}</td>
                            <td>
                              <select
                                value={row.contentId}
                                onChange={(e) => setBatchUploadContent(row.key, e.target.value)}
                                disabled={busy === "mux-batch-upload"}
                              >
                                <option value="">No match</option>
                                {content.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title} ({item.slug})
                                  </option>
                                ))}
                              </select>
                              {matchedItem ? (
                                <div className="label" style={{ marginTop: "0.25rem" }}>
                                  {matchedItem.slug}
                                </div>
                              ) : null}
                            </td>
                            <td><span className="badge">{row.status}</span></td>
                            <td>{row.progress}%</td>
                            <td>{row.error ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="label" style={{ marginTop: "0.5rem" }}>
                    Showing {filteredBatchUploadRows.length} of {batchUploadRows.length} rows.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h2 className="section-title">Bulk Import From Dropbox CSV</h2>
              <div className="row-actions" style={{ marginBottom: "0.6rem" }}>
                <button type="button" className="btn btn-secondary" onClick={downloadBulkImportTemplate}>Download CSV Template</button>
              </div>
              <label className="span-2">
                Upload CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void onBulkCsvFileSelected(e.target.files?.[0] ?? null)}
                />
                <div className="label">{bulkCsvFileName ? `Loaded file: ${bulkCsvFileName}` : "No file selected"}</div>
              </label>
              <label className="span-2">
                Paste CSV
                <textarea
                  rows={8}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder="title,slug,dropbox_url,author,tags,is_premium,publish_status,type,synopsis,release_year,duration_seconds"
                />
              </label>
              <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                <button type="button" className="btn btn-secondary" disabled={busy === "bulk-import" || busy === "bulk-import-retry"} onClick={onPreviewBulkCsv}>
                  Preview CSV
                </button>
                <button type="button" className="btn btn-primary" disabled={busy === "bulk-import"} onClick={() => void onBulkImportFromCsv()}>
                  {busy === "bulk-import" ? "Importing..." : "Start Bulk Import"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy === "bulk-import-retry"} onClick={() => void onRetryFailedBulkImport()}>
                  {busy === "bulk-import-retry" ? "Retrying..." : "Import Only Failed Rows"}
                </button>
              </div>
              {bulkPreviewRows.length ? (
                <div className="table" style={{ marginTop: "0.75rem" }}>
                  <table>
                    <thead><tr><th>CSV Row</th><th>Title</th><th>Slug</th><th>Status</th><th>Type</th><th>Source URL</th></tr></thead>
                    <tbody>
                      {bulkPreviewRows.slice(0, 25).map((row) => (
                        <tr key={`preview-${row.row}-${row.slug}`}>
                          <td>{row.row}</td>
                          <td>{row.title || "-"}</td>
                          <td>{row.slug || "-"}</td>
                          <td>{row.publishStatus}</td>
                          <td>{row.type}</td>
                          <td>{row.sourceUrl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkPreviewRows.length > 25 ? <div className="label">Showing first 25 of {bulkPreviewRows.length} rows.</div> : null}
                </div>
              ) : null}
              <div className="row-actions" style={{ marginTop: "0.4rem" }}>
                <div className="label">Tip: CSV row numbers in preview help match import failures.</div>
              </div>
              {bulkImportResults.length ? (
                <div className="table" style={{ marginTop: "0.75rem" }}>
                  <table>
                    <thead><tr><th>Row</th><th>Status</th><th>Slug</th><th>Mux Asset</th><th>Error</th></tr></thead>
                    <tbody>
                      {bulkImportResults.map((result) => (
                        <tr key={`${result.row}-${result.slug ?? result.error ?? "row"}`}>
                          <td>{result.row}</td>
                          <td><span className="badge">{result.ok ? "ok" : "failed"}</span></td>
                          <td>{result.slug ?? "-"}</td>
                          <td>{result.muxAssetId ?? "-"}</td>
                          <td>{result.error ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h2 className="section-title">Edit Selected Content</h2>
              {!editContentId ? (
                <p className="label" style={{ marginTop: "0.75rem" }}>
                  Click `Edit` on any content row to load its metadata here.
                </p>
              ) : null}
              <form className="form-grid two-col" onSubmit={onSaveEditContent}>
                <label>Slug<input value={editContent.slug} onChange={(e) => setEditContent({ ...editContent, slug: slugify(e.target.value) })} disabled={!editContentId} /></label>
                <label>Title<input value={editContent.title} onChange={(e) => setEditContent((current) => {
                  const nextTitle = e.target.value;
                  const autoPrev = slugify(current.title);
                  const shouldAutoUpdateSlug = !current.slug || current.slug === autoPrev;
                  return { ...current, title: nextTitle, slug: shouldAutoUpdateSlug ? slugify(nextTitle) : current.slug };
                })} disabled={!editContentId} /></label>
                <label>Author<input value={editContent.author} onChange={(e) => setEditContent({ ...editContent, author: e.target.value })} disabled={!editContentId} /></label>
                <label>Type<select value={editContent.type} onChange={(e) => setEditContent({ ...editContent, type: e.target.value })} disabled={!editContentId}><option value="film">Film</option><option value="series">Series</option><option value="episode">Episode</option><option value="trailer">Trailer</option><option value="bonus">Bonus</option></select></label>
                <label>Status<select value={editContent.publishStatus} onChange={(e) => setEditContent({ ...editContent, publishStatus: e.target.value })} disabled={!editContentId}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <label>Duration (sec)<input type="number" min={0} value={editContent.durationSeconds} onChange={(e) => setEditContent({ ...editContent, durationSeconds: Number(e.target.value) })} disabled={!editContentId} /></label>
                <label>Release Year<input type="number" value={editContent.releaseYear} onChange={(e) => setEditContent({ ...editContent, releaseYear: Number(e.target.value) })} disabled={!editContentId} /></label>
                <label className="span-2">Poster URL<input value={editContent.posterUrl} onChange={(e) => setEditContent({ ...editContent, posterUrl: e.target.value })} disabled={!editContentId} /></label>
                <div className="span-2 poster-upload-box">
                  <div className="label">Poster Image Upload</div>
                  <div className="poster-upload-form">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={!editContentId}
                      onChange={(e) => setPosterUploadFile(e.target.files?.[0] ?? null)}
                    />
                    <button type="button" className="btn btn-secondary" disabled={!editContentId || !posterUploadFile || busy === "poster-upload"} onClick={() => void onUploadPoster()}>
                      {busy === "poster-upload" ? "Uploading Poster..." : "Upload Poster"}
                    </button>
                  </div>
                  {editContent.posterUrl ? (
                    <div className="poster-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editContent.posterUrl} alt="Poster preview" />
                      <div className="label">{editContent.posterUrl}</div>
                    </div>
                  ) : (
                    <div className="label">No poster uploaded yet.</div>
                  )}
                </div>
                <label className="span-2">Hero Preview URL (HLS)<input value={editContent.heroPreviewUrl} onChange={(e) => setEditContent({ ...editContent, heroPreviewUrl: e.target.value })} disabled={!editContentId} /></label>
                <label className="span-2">Playback URL (manual fallback)<input value={editContent.playbackUrl} onChange={(e) => setEditContent({ ...editContent, playbackUrl: e.target.value })} disabled={!editContentId} /></label>
                <label className="span-2">Tags CSV<input value={editContent.tagsCsv} onChange={(e) => setEditContent({ ...editContent, tagsCsv: e.target.value })} disabled={!editContentId} /></label>
                <label className="span-2">Synopsis<textarea rows={3} value={editContent.synopsis} onChange={(e) => setEditContent({ ...editContent, synopsis: e.target.value })} disabled={!editContentId} /></label>
                <label className="checkbox"><input type="checkbox" checked={editContent.isPremium} onChange={(e) => setEditContent({ ...editContent, isPremium: e.target.checked })} disabled={!editContentId} />Subscriber only</label>
                <div className="span-2">
                  <div className="label">Video Categories</div>
                  <div className="chips" style={{ marginTop: "0.5rem" }}>
                    {collections.map((row) => (
                      <label key={row.id} className="checkbox" style={{ marginRight: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={editCategoryIds.includes(row.id)}
                          disabled={!editContentId}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditCategoryIds((current) => [...current, row.id]);
                            } else {
                              setEditCategoryIds((current) => current.filter((id) => id !== row.id));
                            }
                          }}
                        />
                        {row.title}
                      </label>
                    ))}
                  </div>
                  <div className="row-actions" style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!editContentId || busy === "save-content-categories"}
                      onClick={() => void onSaveContentCategories()}
                    >
                      {busy === "save-content-categories" ? "Saving Categories..." : "Save Categories"}
                    </button>
                  </div>
                </div>
                <div className="span-2 row-actions">
                  <button className="btn btn-primary" disabled={!editContentId || busy === "save-edit-content"}>{busy === "save-edit-content" ? "Saving..." : "Save Changes"}</button>
                  <button type="button" className="btn btn-secondary" disabled={!editContentId} onClick={() => setEditContentId("")}>Clear Selection</button>
                  {editContentId ? (
                    <button type="button" className="btn btn-danger" disabled={busy === `delete-${editContentId}`} onClick={() => void onDeleteContent(editContentId)}>
                      {busy === `delete-${editContentId}` ? "Deleting..." : "Delete Content"}
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Content Library</h2>
                <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                  <button className="btn btn-secondary" disabled={busy === "backfill-premium-previews"} onClick={() => void onBackfillPremiumPreviews()}>
                    {busy === "backfill-premium-previews" ? "Queuing Premium Previews..." : "Backfill Premium Previews"}
                  </button>
                  <button className="btn btn-secondary" onClick={exportContentCsv}>Export Content CSV</button>
                </div>
              </div>
              <div className="form-grid two-col" style={{ padding: "0.75rem 1rem 0" }}>
                <label>Search
                  <input value={contentQuery} onChange={(e) => setContentQuery(e.target.value)} placeholder="Title, slug, tags..." />
                </label>
                <label>Status
                  <select value={contentStatusFilter} onChange={(e) => setContentStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>Media
                  <select value={contentMediaFilter} onChange={(e) => setContentMediaFilter(e.target.value)}>
                    <option value="all">All media states</option>
                    <option value="missing-playback">Missing playback</option>
                    <option value="missing-poster">Missing poster</option>
                    <option value="mux-processing">Mux processing</option>
                    <option value="mux-errored">Mux errored</option>
                    <option value="ready">Playback ready</option>
                  </select>
                </label>
              </div>
              <table><thead><tr><th>Title</th><th>Author</th><th>Slug</th><th>Status</th><th>Video</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>
                {filteredContent.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td><td>{item.author || "n/a"}</td><td>{item.slug}</td><td><span className="badge">{item.publishStatus}</span></td><td>{item.videoStatus ?? "none"}{item.muxPlaybackId ? " (ready)" : ""}</td><td>{item.isPremium ? "Subscribers" : "Public"}</td>
                    <td><div className="row-actions">
                      <button className="btn-inline" onClick={() => selectForEdit(item)}>Edit</button>
                      <button className="btn-inline" onClick={() => void setStatus(item.id, "published")}>Publish</button>
                      <button className="btn-inline" onClick={() => void setStatus(item.id, "draft")}>Draft</button>
                      <button className="btn-inline danger" onClick={() => void setStatus(item.id, "archived")}>Archive</button>
                      <button className="btn-inline danger" onClick={() => void onDeleteContent(item.id)}>{busy === `delete-${item.id}` ? "Deleting..." : "Delete"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </>
        ) : null}

        {tab === "categories" ? (
          <>
            <div className="card">
              <h2 className="section-title">Create Category</h2>
              <form className="form-grid two-col" onSubmit={onCreateCollection}>
                <label>Key<input value={newCollection.key} onChange={(e) => setNewCollection({ ...newCollection, key: e.target.value })} placeholder="new-releases" /></label>
                <label>Title<input value={newCollection.title} onChange={(e) => setNewCollection({ ...newCollection, title: e.target.value })} /></label>
                <label>Source Tag<input value={newCollection.sourceTag} onChange={(e) => setNewCollection({ ...newCollection, sourceTag: e.target.value })} placeholder="space-mob" /></label>
                <label>Auto Row Limit<input type="number" min={1} max={48} value={newCollection.sourceLimit} onChange={(e) => setNewCollection({ ...newCollection, sourceLimit: Number(e.target.value) })} /></label>
                <label>Sort Order<input type="number" value={newCollection.sortOrder} onChange={(e) => setNewCollection({ ...newCollection, sortOrder: Number(e.target.value) })} /></label>
                <label className="checkbox"><input type="checkbox" checked={newCollection.isPublic} onChange={(e) => setNewCollection({ ...newCollection, isPublic: e.target.checked })} />Public category</label>
                <div className="span-2"><button className="btn btn-primary" disabled={busy === "create-collection"}>{busy === "create-collection" ? "Creating..." : "Create Category"}</button></div>
              </form>
            </div>
            <div className="card">
              <div className="row__header">
                <h2 className="section-title">Category CSV</h2>
                <div className="row-actions">
                  <button type="button" className="btn btn-secondary" onClick={downloadCategoryCsvTemplate}>Download Template</button>
                  <button type="button" className="btn btn-secondary" onClick={exportCategoriesCsv}>Export Categories CSV</button>
                </div>
              </div>
              <div className="form-grid two-col" style={{ marginTop: "0.75rem" }}>
                <label className="span-2">Import category CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void onCategoryCsvFileSelected(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="span-2">CSV preview / paste area
                  <textarea
                    rows={6}
                    value={categoryCsvText}
                    onChange={(e) => setCategoryCsvText(e.target.value)}
                    placeholder="key,title,description,source_tag,source_limit,sort_order,is_public,is_active,video_slugs"
                  />
                </label>
                <div className="label span-2">
                  Format: one row per category. Use `video_slugs` separated by `|`, for example `space-cadets|sewer-cats|free-agent`.
                  {categoryCsvFileName ? ` Loaded file: ${categoryCsvFileName}.` : ""}
                </div>
                <div className="span-2 row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void onImportCategoriesCsv()}
                    disabled={busy === "import-categories-csv"}
                  >
                    {busy === "import-categories-csv" ? "Importing..." : "Import Categories CSV"}
                  </button>
                </div>
              </div>
            </div>
            <div className="stack">
              {[...collections].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => (
                <div
                  className={`card ${dragCategoryId === row.id ? "is-dragging" : ""} ${dropCategoryId === row.id ? "is-drop-target" : ""}`}
                  key={row.id}
                  draggable
                  onDragStart={() => {
                    setDragCategoryId(row.id);
                    setDropCategoryId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragCategoryId && dragCategoryId !== row.id) {
                      setDropCategoryId(row.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropCategoryId === row.id) {
                      setDropCategoryId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void onDropCategory(row.id);
                  }}
                  onDragEnd={() => {
                    setDragCategoryId(null);
                    setDropCategoryId(null);
                  }}
                >
                  {(() => {
                    const meta = collectionMetaDrafts[row.id] ?? {
                      title: row.title,
                      description: row.description ?? "",
                      sourceTag: row.sourceTag ?? "",
                      sourceLimit: row.sourceLimit ?? 24,
                      sortOrder: row.sortOrder,
                      isPublic: row.isPublic,
                      isActive: row.isActive ?? true
                    };
                    return (
                      <>
                        <div className="collection-head">
                          <div>
                            <h3>{meta.title || row.title}</h3>
                            <div className="label">
                              {row.key} | sort {meta.sortOrder} | {row.sourceTag?.trim()
                                ? `auto tag: ${row.sourceTag}`
                                : `manual videos: ${(collectionDrafts[row.id] ?? []).length}`}
                            </div>
                          </div>
                          <div className="row-actions">
                            <button type="button" className="btn-inline" onClick={() => toggleCategoryCollapsed(row.id)}>
                              {collapsedCategoryIds[row.id] ? "Expand" : "Collapse"}
                            </button>
                            <button
                              type="button"
                              className="btn-inline danger"
                              onClick={() => void onDeleteCollection(row.id)}
                              disabled={busy === `delete-collection-${row.id}`}
                            >
                              {busy === `delete-collection-${row.id}` ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                        {!collapsedCategoryIds[row.id] ? (
                          <>
                            <div className="label" style={{ marginTop: "0.4rem" }}>Drag this card to reorder categories.</div>
                            <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                              <button className="btn-inline" onClick={() => void moveCategory(row.id, "up")} disabled={busy === "reorder-categories"}>Move Up</button>
                              <button className="btn-inline" onClick={() => void moveCategory(row.id, "down")} disabled={busy === "reorder-categories"}>Move Down</button>
                            </div>
                            <div className="form-grid two-col" style={{ marginTop: "0.75rem" }}>
                              <label>Row Title
                                <input value={meta.title} onChange={(e) => updateCollectionMetaDraft(row.id, { title: e.target.value })} />
                              </label>
                              <label>Source Tag
                                <input value={meta.sourceTag} onChange={(e) => updateCollectionMetaDraft(row.id, { sourceTag: e.target.value })} placeholder="space-mob" />
                              </label>
                              <label>Auto Row Limit
                                <input type="number" min={1} max={48} value={meta.sourceLimit} onChange={(e) => updateCollectionMetaDraft(row.id, { sourceLimit: Number(e.target.value) })} />
                              </label>
                              <label>Sort Order
                                <input type="number" value={meta.sortOrder} onChange={(e) => updateCollectionMetaDraft(row.id, { sortOrder: Number(e.target.value) })} />
                              </label>
                              <label className="span-2">Description
                                <input value={meta.description} onChange={(e) => updateCollectionMetaDraft(row.id, { description: e.target.value })} />
                              </label>
                              <label className="checkbox"><input type="checkbox" checked={meta.isPublic} onChange={(e) => updateCollectionMetaDraft(row.id, { isPublic: e.target.checked })} />Public category</label>
                              <label className="checkbox"><input type="checkbox" checked={meta.isActive} onChange={(e) => updateCollectionMetaDraft(row.id, { isActive: e.target.checked })} />Active category</label>
                            </div>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                  {!collapsedCategoryIds[row.id] ? (
                    <>
                      <p className="label">
                        {row.sourceTag?.trim()
                          ? `Auto-populates from tag "${row.sourceTag}"${row.sourceLimit ? ` (up to ${row.sourceLimit})` : ""}. Manual slugs below are kept as fallback only.`
                          : `Current videos: ${row.items.map((i) => i.slug).join(", ") || "none"}`}
                      </p>
                      <div className="collection-videos">
                        <div className="label">Ordered videos in this row</div>
                        {(collectionDrafts[row.id] ?? []).length ? (
                          <div className="collection-video-list">
                            {(collectionDrafts[row.id] ?? []).map((slug, index, list) => (
                              <div className="collection-video-item" key={`${row.id}-${slug}`}>
                                <div>
                                  <strong>{index + 1}. {slug}</strong>
                                </div>
                                <div className="row-actions">
                                  <button type="button" className="btn-inline" onClick={() => moveCollectionSlug(row.id, slug, "up")} disabled={index === 0}>Up</button>
                                  <button type="button" className="btn-inline" onClick={() => moveCollectionSlug(row.id, slug, "down")} disabled={index === list.length - 1}>Down</button>
                                  <button type="button" className="btn-inline danger" onClick={() => removeCollectionSlug(row.id, slug)}>Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="label">No manual videos assigned yet.</p>
                        )}

                        <div className="collection-video-add">
                          <label>Add video by slug
                            <input
                              list={`collection-slugs-${row.id}`}
                              value={collectionSlugInputDrafts[row.id] ?? ""}
                              onChange={(e) => setCollectionSlugInputDrafts({ ...collectionSlugInputDrafts, [row.id]: e.target.value })}
                              placeholder="start typing a slug..."
                            />
                            <datalist id={`collection-slugs-${row.id}`}>
                              {content.map((item) => (
                                <option key={item.id} value={item.slug}>{item.title}</option>
                              ))}
                            </datalist>
                          </label>
                          <button type="button" className="btn-inline" onClick={() => addCollectionSlug(row.id)}>Add</button>
                        </div>
                      </div>
                      <div className="row-actions"><button className="btn btn-secondary" onClick={() => void saveCollectionItems(row)} disabled={busy === `row-${row.id}`}>{busy === `row-${row.id}` ? "Saving..." : "Save Category Settings"}</button></div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === "marketing" ? (
          <>
            <div className="card">
              <h2 className="section-title">Push Notifications</h2>
              <form className="form-grid two-col" onSubmit={onSendPushCampaign}>
                <label>Title
                  <input value={newPushCampaign.title} onChange={(e) => setNewPushCampaign({ ...newPushCampaign, title: e.target.value })} placeholder="New film just dropped" />
                </label>
                <label>Audience
                  <select value={newPushCampaign.audience} onChange={(e) => setNewPushCampaign({ ...newPushCampaign, audience: e.target.value })}>
                    <option value="subscribers">Subscribers</option>
                    <option value="all">All devices</option>
                    <option value="inactive">Inactive / free users</option>
                  </select>
                </label>
                <label>Platform
                  <select value={newPushCampaign.platform} onChange={(e) => setNewPushCampaign({ ...newPushCampaign, platform: e.target.value })}>
                    <option value="all">All platforms</option>
                    <option value="web">Web</option>
                    <option value="roku">Roku</option>
                    <option value="fire_tv">Fire TV</option>
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                  </select>
                </label>
                <label>Deep Link (optional)
                  <input value={newPushCampaign.deeplinkUrl} onChange={(e) => setNewPushCampaign({ ...newPushCampaign, deeplinkUrl: e.target.value })} placeholder="https://flyhigh.tv/watch/waketest" />
                </label>
                <label className="span-2">Message
                  <textarea rows={3} value={newPushCampaign.message} onChange={(e) => setNewPushCampaign({ ...newPushCampaign, message: e.target.value })} placeholder="Watch the latest wakeboard edit now." />
                </label>
                <div className="span-2">
                  <button className="btn btn-primary" disabled={busy === "send-push"}>{busy === "send-push" ? "Sending..." : "Send Push Notification"}</button>
                </div>
              </form>
              <p className="label" style={{ marginTop: "0.6rem" }}>
                Live send requires `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` on API.
              </p>
            </div>

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Push Campaign History</h2>
              </div>
              <table>
                <thead><tr><th>Created</th><th>Title</th><th>Target</th><th>Status</th><th>Sent</th><th>Failed</th></tr></thead>
                <tbody>
                  {pushCampaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>{new Date(campaign.createdAt).toLocaleString()}</td>
                      <td>{campaign.title}<div className="label">{campaign.message}</div></td>
                      <td>{campaign.target}</td>
                      <td><span className="badge">{campaign.status}</span></td>
                      <td>{campaign.sentCount}</td>
                      <td>{campaign.failedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Registered Push Devices</h2>
              </div>
              <table>
                <thead><tr><th>Platform</th><th>Device</th><th>User</th><th>Token</th><th>Last Seen</th><th>Status</th></tr></thead>
                <tbody>
                  {pushDevices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.platform}</td>
                      <td>{device.deviceName || "-"}</td>
                      <td>{device.user ? `${device.user.displayName || device.user.email}` : "anonymous"}</td>
                      <td>...{device.tokenLast4}</td>
                      <td>{new Date(device.lastSeenAt).toLocaleString()}</td>
                      <td><span className="badge">{device.isActive ? "active" : "inactive"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2 className="section-title">Create Coupon / Free Trial</h2>
              <form className="form-grid two-col" onSubmit={onCreateCoupon}>
                <label>Code
                  <input value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} placeholder="WELCOME14" />
                </label>
                <label>Name
                  <input value={newCoupon.name} onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })} placeholder="Welcome trial" />
                </label>
                <label>Type
                  <select value={newCoupon.kind} onChange={(e) => setNewCoupon({ ...newCoupon, kind: e.target.value as "percent_off" | "amount_off" | "free_trial" })}>
                    <option value="free_trial">Free trial days</option>
                    <option value="percent_off">Percent off</option>
                    <option value="amount_off">Fixed amount off</option>
                  </select>
                </label>
                <label>Duration
                  <select value={newCoupon.duration} onChange={(e) => setNewCoupon({ ...newCoupon, duration: e.target.value as "once" | "repeating" | "forever" })}>
                    <option value="once">once</option>
                    <option value="repeating">repeating</option>
                    <option value="forever">forever</option>
                  </select>
                </label>
                {newCoupon.kind === "percent_off" ? (
                  <label>Percent off
                    <input type="number" min={1} max={100} value={newCoupon.percentOff} onChange={(e) => setNewCoupon({ ...newCoupon, percentOff: Number(e.target.value) })} />
                  </label>
                ) : null}
                {newCoupon.kind === "amount_off" ? (
                  <label>Amount off (cents)
                    <input type="number" min={1} value={newCoupon.amountOffCents} onChange={(e) => setNewCoupon({ ...newCoupon, amountOffCents: Number(e.target.value) })} />
                  </label>
                ) : null}
                {newCoupon.kind === "free_trial" ? (
                  <label>Trial days
                    <input type="number" min={1} max={365} value={newCoupon.trialDays} onChange={(e) => setNewCoupon({ ...newCoupon, trialDays: Number(e.target.value) })} />
                  </label>
                ) : null}
                {newCoupon.duration === "repeating" ? (
                  <label>Duration months
                    <input type="number" min={1} value={newCoupon.durationInMonths} onChange={(e) => setNewCoupon({ ...newCoupon, durationInMonths: Number(e.target.value) })} />
                  </label>
                ) : null}
                <label>Max redemptions (0 = unlimited)
                  <input type="number" min={0} value={newCoupon.maxRedemptions} onChange={(e) => setNewCoupon({ ...newCoupon, maxRedemptions: Number(e.target.value) })} />
                </label>
                <label>Expires on (optional)
                  <input type="date" value={newCoupon.expiresAt} onChange={(e) => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })} />
                </label>
                <label className="checkbox"><input type="checkbox" checked={newCoupon.isActive} onChange={(e) => setNewCoupon({ ...newCoupon, isActive: e.target.checked })} />Active coupon</label>
                <div className="span-2">
                  <button className="btn btn-primary" disabled={busy === "create-coupon"}>{busy === "create-coupon" ? "Creating..." : "Create Coupon"}</button>
                </div>
              </form>
            </div>

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Coupons</h2>
                <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                  <button className="btn btn-secondary" onClick={exportCouponsCsv}>Export Coupons CSV</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Offer</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td>{coupon.code}<div className="label">{coupon.name}</div></td>
                      <td>{coupon.kind}</td>
                      <td>
                        {coupon.kind === "percent_off" ? `${coupon.percentOff ?? 0}% off` : null}
                        {coupon.kind === "amount_off" ? `$${((coupon.amountOffCents ?? 0) / 100).toFixed(2)} off` : null}
                        {coupon.kind === "free_trial" ? `${coupon.trialDays ?? 0} day trial` : null}
                        <div className="label">{coupon.duration}</div>
                      </td>
                      <td>{coupon.redemptionCount}{typeof coupon.maxRedemptions === "number" ? ` / ${coupon.maxRedemptions}` : ""}</td>
                      <td><span className="badge">{coupon.isActive ? "active" : "inactive"}</span></td>
                      <td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "none"}</td>
                      <td>
                        <button
                          className={`btn-inline ${coupon.isActive ? "danger" : ""}`}
                          onClick={() => void onToggleCoupon(coupon.id, !coupon.isActive)}
                          disabled={busy === `coupon-${coupon.id}`}
                        >
                          {busy === `coupon-${coupon.id}` ? "Saving..." : coupon.isActive ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2 className="section-title">Create Gift Card Product</h2>
              <form className="form-grid two-col" onSubmit={onCreateGiftCardProduct}>
                <label>Code
                  <input value={newGiftCardProduct.code} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, code: e.target.value.toUpperCase() })} placeholder="GIFT1MO" />
                </label>
                <label>Name
                  <input value={newGiftCardProduct.name} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, name: e.target.value })} placeholder="1 Month Gift Card" />
                </label>
                <label className="span-2">Description
                  <input value={newGiftCardProduct.description} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, description: e.target.value })} placeholder="A prepaid month of FlyHigh TV access." />
                </label>
                <label>Amount (cents)
                  <input type="number" min={1} value={newGiftCardProduct.amountCents} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, amountCents: Number(e.target.value) })} />
                </label>
                <label>Duration months
                  <input type="number" min={1} value={newGiftCardProduct.durationMonths} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, durationMonths: Number(e.target.value) })} />
                </label>
                <label>Plan
                  <select value={newGiftCardProduct.planCode} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, planCode: e.target.value })}>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.code}>{plan.name} ({plan.code})</option>
                    ))}
                  </select>
                </label>
                <label>Stripe Price ID
                  <input value={newGiftCardProduct.stripePriceId} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, stripePriceId: e.target.value })} placeholder="price_..." />
                </label>
                <label className="checkbox"><input type="checkbox" checked={newGiftCardProduct.isActive} onChange={(e) => setNewGiftCardProduct({ ...newGiftCardProduct, isActive: e.target.checked })} />Active product</label>
                <div className="span-2">
                  <button className="btn btn-primary" disabled={busy === "create-gift-card-product"}>{busy === "create-gift-card-product" ? "Creating..." : "Create Gift Card Product"}</button>
                </div>
              </form>
            </div>

            {giftCardAnalytics ? (
              <>
                <div className="content content--feature-grid">
                  <article className="feature-card">
                    <h3>Total Purchases</h3>
                    <p>{giftCardAnalytics.totals.purchaseCount}</p>
                  </article>
                  <article className="feature-card">
                    <h3>Issued Codes</h3>
                    <p>{giftCardAnalytics.totals.issuedCount}</p>
                  </article>
                  <article className="feature-card">
                    <h3>Redeemed Codes</h3>
                    <p>{giftCardAnalytics.totals.redeemedCount}</p>
                  </article>
                  <article className="feature-card">
                    <h3>Gift Card Revenue</h3>
                    <p>${giftCardAnalytics.totals.revenueUsd.toFixed(2)}</p>
                  </article>
                </div>

                <div className="table">
                  <div className="table-head">
                    <h2 className="section-title">Gift Card Performance By Product</h2>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Duration</th>
                        <th>Purchases</th>
                        <th>Issued</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {giftCardAnalytics.byProduct.map((row) => (
                        <tr key={row.id}>
                          <td>{row.code}<div className="label">{row.name}</div></td>
                          <td>${row.amountUsd.toFixed(2)}</td>
                          <td>{row.durationMonths} month(s)</td>
                          <td>{row.purchaseCount}</td>
                          <td>{row.issuedCount}</td>
                          <td>${row.revenueUsd.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="table">
                  <div className="table-head">
                    <h2 className="section-title">Recent Gift Card Purchases</h2>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Purchaser</th>
                        <th>Recipient</th>
                        <th>Product</th>
                        <th>Status</th>
                        <th>Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {giftCardAnalytics.recentPurchases.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.purchaserName}</td>
                          <td>{row.recipientEmail}</td>
                          <td>{row.productName}<div className="label">${row.amountUsd.toFixed(2)}</div></td>
                          <td><span className="badge">{row.status}</span>{row.redeemedAt ? <div className="label">redeemed {new Date(row.redeemedAt).toLocaleDateString()}</div> : null}</td>
                          <td>{row.code || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Gift Card Products</h2>
              </div>
              <div className="stack">
                {giftCardProducts.map((product) => {
                  const draft = giftCardProductDrafts[product.id];
                  if (!draft) return null;
                  return (
                    <div className="card" key={product.id}>
                      <div className="row__header">
                        <h3 className="section-title">{draft.name || product.name} ({draft.code || product.code})</h3>
                        <span className="badge">{draft.isActive ? "active" : "inactive"}</span>
                      </div>
                      <form
                        className="form-grid two-col"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onSaveGiftCardProduct(product.id);
                        }}
                      >
                        <label>Code
                          <input value={draft.code} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, code: e.target.value.toUpperCase() } }))} />
                        </label>
                        <label>Name
                          <input value={draft.name} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, name: e.target.value } }))} />
                        </label>
                        <label className="span-2">Description
                          <input value={draft.description} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, description: e.target.value } }))} />
                        </label>
                        <label>Amount (cents)
                          <input type="number" min={1} value={draft.amountCents} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, amountCents: Number(e.target.value) } }))} />
                        </label>
                        <label>Duration months
                          <input type="number" min={1} value={draft.durationMonths} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, durationMonths: Number(e.target.value) } }))} />
                        </label>
                        <label>Currency
                          <input value={draft.currency} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, currency: e.target.value.toUpperCase() } }))} />
                        </label>
                        <label>Plan
                          <select value={draft.planCode} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, planCode: e.target.value } }))}>
                            {plans.map((plan) => (
                              <option key={plan.id} value={plan.code}>{plan.name} ({plan.code})</option>
                            ))}
                          </select>
                        </label>
                        <label className="span-2">Stripe Price ID
                          <input value={draft.stripePriceId} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, stripePriceId: e.target.value } }))} />
                        </label>
                        <label className="checkbox"><input type="checkbox" checked={draft.isActive} onChange={(e) => setGiftCardProductDrafts((current) => ({ ...current, [product.id]: { ...draft, isActive: e.target.checked } }))} />Active product</label>
                        <div className="span-2 row-actions">
                          <button className="btn btn-secondary" disabled={busy === `save-gift-card-product-${product.id}`}>{busy === `save-gift-card-product-${product.id}` ? "Saving..." : "Save Gift Card Product"}</button>
                          <button
                            type="button"
                            className={`btn-inline ${draft.isActive ? "danger" : ""}`}
                            onClick={() => void onToggleGiftCardProduct(product.id, !draft.isActive)}
                            disabled={busy === `gift-card-product-${product.id}`}
                          >
                            {busy === `gift-card-product-${product.id}` ? "Saving..." : draft.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                        <p className="label span-2">{product.purchaseCount} purchases / {product.issuedCount} issued</p>
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="table">
              <div className="table-head">
                <h2 className="section-title">Issued Gift Cards</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Recipient</th>
                    <th>Purchaser</th>
                    <th>Status</th>
                    <th>Redeemed By</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {giftCards.map((card) => (
                    <tr key={card.id}>
                      <td>{card.code}</td>
                      <td>{card.productName}<div className="label">{card.durationMonths} month(s)</div></td>
                      <td>{card.recipientName || "-" }<div className="label">{card.recipientEmail}</div></td>
                      <td>{card.purchaserName}<div className="label">{card.purchaserEmail}</div></td>
                      <td><span className="badge">{card.status}</span></td>
                      <td>{card.redeemedBy || "not yet"}{card.redeemedAt ? <div className="label">{new Date(card.redeemedAt).toLocaleString()}</div> : null}</td>
                      <td>{new Date(card.createdAt).toLocaleString()}</td>
                      <td>
                        <button className="btn-inline" onClick={() => void onResendGiftCard(card.id)} disabled={busy === `gift-card-resend-${card.id}`}>
                          {busy === `gift-card-resend-${card.id}` ? "Sending..." : "Resend Email"}
                        </button>
                        {card.status !== "redeemed" ? (
                          <button className="btn-inline danger" onClick={() => void onVoidGiftCard(card.id)} disabled={busy === `gift-card-void-${card.id}`}>
                            {busy === `gift-card-void-${card.id}` ? "Voiding..." : "Void"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2 className="section-title">Create Plan / Pricing</h2>
              <form className="form-grid two-col" onSubmit={onCreatePlan}>
                <label>Code
                  <input value={newPlan.code} onChange={(e) => setNewPlan({ ...newPlan, code: e.target.value })} placeholder="monthly" />
                </label>
                <label>Name
                  <input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} placeholder="Monthly" />
                </label>
                <label>Interval
                  <select value={newPlan.interval} onChange={(e) => setNewPlan({ ...newPlan, interval: e.target.value })}>
                    <option value="month">month</option>
                    <option value="year">year</option>
                    <option value="week">week</option>
                  </select>
                </label>
                <label>Price (cents)
                  <input type="number" min={0} value={newPlan.priceCents} onChange={(e) => setNewPlan({ ...newPlan, priceCents: Number(e.target.value) })} />
                </label>
                <label>Currency
                  <input value={newPlan.currency} onChange={(e) => setNewPlan({ ...newPlan, currency: e.target.value.toUpperCase() })} />
                </label>
                <label>Stripe Price ID
                  <input value={newPlan.providerPriceId} onChange={(e) => setNewPlan({ ...newPlan, providerPriceId: e.target.value })} placeholder="price_..." />
                </label>
                <label className="checkbox"><input type="checkbox" checked={newPlan.isActive} onChange={(e) => setNewPlan({ ...newPlan, isActive: e.target.checked })} />Active plan</label>
                <div className="span-2">
                  <button className="btn btn-primary" disabled={busy === "create-plan"}>{busy === "create-plan" ? "Creating..." : "Create Plan"}</button>
                </div>
              </form>
            </div>

            <div className="stack">
              {plans.map((plan) => {
                const draft = planDrafts[plan.id];
                if (!draft) return null;
                return (
                  <div className="card" key={plan.id}>
                    <div className="row__header">
                      <h2 className="section-title">{draft.name || plan.name} ({draft.code || plan.code})</h2>
                      <span className="badge">{draft.isActive ? "active" : "inactive"}</span>
                    </div>
                    <form
                      className="form-grid two-col"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onSavePlan(plan.id);
                      }}
                    >
                      <label>Code
                        <input value={draft.code} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, code: e.target.value } }))} />
                      </label>
                      <label>Name
                        <input value={draft.name} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, name: e.target.value } }))} />
                      </label>
                      <label>Interval
                        <select value={draft.interval} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, interval: e.target.value } }))}>
                          <option value="month">month</option>
                          <option value="year">year</option>
                          <option value="week">week</option>
                        </select>
                      </label>
                      <label>Price (cents)
                        <input type="number" min={0} value={draft.priceCents} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, priceCents: Number(e.target.value) } }))} />
                      </label>
                      <label>Currency
                        <input value={draft.currency} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, currency: e.target.value.toUpperCase() } }))} />
                      </label>
                      <label>Stripe Price ID
                        <input value={draft.providerPriceId} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, providerPriceId: e.target.value } }))} placeholder="price_..." />
                      </label>
                      <label className="checkbox"><input type="checkbox" checked={draft.isActive} onChange={(e) => setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, isActive: e.target.checked } }))} />Active plan</label>
                      <div className="span-2">
                        <button className="btn btn-secondary" disabled={busy === `save-plan-${plan.id}`}>{busy === `save-plan-${plan.id}` ? "Saving..." : "Save Plan"}</button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>

          </>
        ) : null}

        {tab === "subscribers" ? (
          <div className="table">
            <div className="table-head">
              <h2 className="section-title">Subscribers</h2>
              <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                <button className="btn btn-secondary" onClick={exportSubscribersCsv}>Export Subscribers CSV</button>
              </div>
            </div>
            <div className="form-grid two-col" style={{ padding: "0.75rem 1rem 0" }}>
              <label>Search
                <input value={subscriberQuery} onChange={(e) => setSubscriberQuery(e.target.value)} placeholder="Name or email..." />
              </label>
              <label>Status
                <select value={subscriberStatusFilter} onChange={(e) => setSubscriberStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                  <option value="inactive">Inactive</option>
                  <option value="none">No subscription</option>
                </select>
              </label>
            </div>
            <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Subscription</th><th>Actions</th></tr></thead><tbody>
            {filteredSubscribers.map((s) => <tr key={s.id}><td>{s.displayName}</td><td>{s.email}</td><td>{s.role}</td><td>{s.latestSubscription ? `${s.latestSubscription.status} (${s.latestSubscription.planName})` : "none"}</td>
              <td>
                <div className="row-actions">
                  <button className="btn-inline" onClick={() => void onSetSubscriberStatus(s.id, "trialing")} disabled={busy === `sub-${s.id}-trialing`}>Trial</button>
                  <button className="btn-inline" onClick={() => void onSetSubscriberStatus(s.id, "active")} disabled={busy === `sub-${s.id}-active`}>Activate</button>
                  <button className="btn-inline danger" onClick={() => void onSetSubscriberStatus(s.id, "canceled")} disabled={busy === `sub-${s.id}-canceled`}>Cancel</button>
                </div>
              </td>
            </tr>)}
          </tbody></table></div>
        ) : null}
      </section>
    </main>
  );
}

