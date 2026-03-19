import { env } from "./env.js";

const MUX_API_BASE = "https://api.mux.com";

export function isMuxConfigured(): boolean {
  return Boolean(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET);
}

function muxAuthHeader(): string {
  const token = Buffer.from(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function muxRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isMuxConfigured()) {
    throw new Error("Mux is not configured");
  }

  const response = await fetch(`${MUX_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: muxAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const muxMessage =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof (payload as { error?: { messages?: string[] } }).error === "object"
        ? ((payload as { error?: { messages?: string[] } }).error?.messages ?? []).join(", ")
        : null;
    throw new Error(muxMessage || `Mux request failed (${response.status})`);
  }

  return payload as T;
}

export interface MuxDirectUploadResponse {
  data: {
    id: string;
    url: string;
    status: string;
    timeout?: number;
  };
}

export interface MuxAssetCreateResponse {
  data: {
    id: string;
    status: string;
    passthrough?: string | null;
    playback_ids?: Array<{ id: string; policy: string }>;
  };
}

export async function createMuxDirectUpload(params: {
  contentId: string;
  corsOrigin?: string;
}): Promise<MuxDirectUploadResponse["data"]> {
  const payload = await muxRequest<MuxDirectUploadResponse>("/video/v1/uploads", {
    method: "POST",
    body: JSON.stringify({
      cors_origin: params.corsOrigin,
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: params.contentId
      }
    })
  });

  return payload.data;
}

export async function createMuxAssetFromUrl(params: {
  contentId: string;
  inputUrl: string;
}): Promise<MuxAssetCreateResponse["data"]> {
  const payload = await muxRequest<MuxAssetCreateResponse>("/video/v1/assets", {
    method: "POST",
    body: JSON.stringify({
      input: params.inputUrl,
      playback_policy: ["public"],
      passthrough: params.contentId
    })
  });

  return payload.data;
}

export function getMuxPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5`;
}
