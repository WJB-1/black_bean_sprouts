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

function hasRequestBody(options?: RequestInit): boolean {
  return options?.body !== undefined && options.body !== null;
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function buildHeaders(options?: RequestInit): Headers {
  const init = options?.headers;
  const headers = new Headers(init);
  const token = getStoredToken();
  if (hasRequestBody(options) && !isFormDataBody(options?.body) && !headers.has("Content-Type")) {
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
  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      ...options,
      headers: buildHeaders(options),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(`网络请求失败: ${message}。请检查后端服务是否已启动 (http://localhost:3000)`);
  }

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

export type ProjectSkillSummary = {
  name: string;
  description: string;
  relativePath: string;
  hash: string;
  updatedAt: string;
};

export type ProjectSkillDetail = ProjectSkillSummary & {
  content: string;
  body: string;
};

export type ProjectSkillTestResult = {
  skillName: string;
  mode: "dry-run" | "live";
  promptPreview: string;
  reply?: string;
};

export function listProjectSkills() {
  return apiFetch<ProjectSkillSummary[]>("/admin/project-skills");
}

export function getProjectSkill(name: string) {
  return apiFetch<ProjectSkillDetail>(`/admin/project-skills/${encodeURIComponent(name)}`);
}

export function saveProjectSkill(
  name: string,
  payload: { description?: string; content?: string; body?: string },
) {
  return apiFetch<ProjectSkillDetail>(`/admin/project-skills/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProjectSkill(name: string) {
  return apiFetch<{ deleted: true; name: string }>(
    `/admin/project-skills/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

export function testProjectSkills(payload: {
  skillNames: string[];
  message: string;
  live?: boolean;
}) {
  return apiFetch<{ results: ProjectSkillTestResult[] }>("/admin/project-skills/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
