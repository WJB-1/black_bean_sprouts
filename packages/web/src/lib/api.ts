import { getAccessToken, clearTokens } from "./token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearTokens();
    window.location.href = "/login";
    throw new ApiError(401, "UNAUTHORIZED", "登录已过期");
  }

  if (!res.ok) {
    const body = await res.json() as { error?: { code?: string; message?: string } };
    throw new ApiError(
      res.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "请求失败",
    );
  }

  return res.json() as Promise<T>;
}
