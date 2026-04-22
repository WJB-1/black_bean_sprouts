import { clearTokens, getAccessToken } from "./token.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function redirectToLogin(): void {
  if (window.location.pathname === "/login") {
    return;
  }

  const redirect = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  );
  window.location.assign(`/login?redirect=${redirect}`);
}

async function readErrorPayload(res: Response): Promise<ApiError> {
  const fallbackMessage = res.status >= 500 ? "服务暂时不可用，请稍后重试" : "请求失败";
  const raw = await res.text();

  if (!raw) {
    return new ApiError(res.status, "UNKNOWN", fallbackMessage);
  }

  try {
    const body = JSON.parse(raw) as {
      error?: { code?: string; message?: string };
    };
    return new ApiError(
      res.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? fallbackMessage,
    );
  } catch {
    return new ApiError(res.status, "UNKNOWN", raw || fallbackMessage);
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
    redirectToLogin();
    throw new ApiError(401, "UNAUTHORIZED", "登录已过期，请重新登录");
  }

  if (!res.ok) {
    throw await readErrorPayload(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
