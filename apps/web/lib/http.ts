import { WEB_API_URL } from "./runtime";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WEB_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const rawMessage =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: string }).error ?? "Request failed")
        : `Request failed (${response.status})`;
    const message = response.status >= 500 ? "Something went wrong on our side. Please try again." : rawMessage;
    const code =
      typeof payload === "object" && payload && "code" in payload
        ? String((payload as { code?: string }).code ?? "")
        : undefined;
    throw new ApiError(message, {
      status: response.status,
      code
    });
  }

  return payload as T;
}
