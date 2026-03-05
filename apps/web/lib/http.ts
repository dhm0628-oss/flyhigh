import { WEB_API_URL } from "./runtime";

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
    throw new Error(message);
  }

  return payload as T;
}
