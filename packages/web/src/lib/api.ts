const BASE_URL = "/api";
const TOKEN_STORAGE_KEY = "bbs-auth-token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setApiToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearApiToken() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getStoredToken();
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const error = typeof record.error === "string" ? record.error.trim() : "";
  const details = Array.isArray(record.details)
    ? record.details.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (error && details.length) {
    return `${error}: ${details.join("; ")}`;
  }
  if (error) {
    return error;
  }
  return fallback;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(BASE_URL + path, {
    ...options,
    headers: buildHeaders(options?.headers),
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      try {
        throw new Error(readErrorMessage(JSON.parse(text), `API error: ${response.status}`));
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
      }
    }

    throw new Error(text.trim() || `API error: ${response.status}`);
  }

  if (!text.trim()) {
    throw new Error("API returned an empty response.");
  }

  if (!contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text.trim());
    }
  }

  return JSON.parse(text) as T;
}
