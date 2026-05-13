import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawAgentRunner, OpenClawRawEvent } from "@black-bean-sprouts/xiaolongxia-kernel";
import {
  buildAgentDocumentPrompt,
  resolveAgentDocumentWorkspacePaths,
} from "../services/agent-document-workspace.js";

type ClaudeSessionEntry = {
  readonly sessionId?: string;
  readonly updatedAt?: number;
};

type ClaudeSessionStore = Record<string, ClaudeSessionEntry>;

type ClaudeRunOutput = {
  readonly stdout: string;
  readonly stderr: string;
  readonly jsonValues: unknown[];
};

type ClaudeRunMode = "json" | "stream-json";

const DEFAULT_TIMEOUT_MS = 120_000;
const SAFE_SESSION_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

function getBlackBeanSproutsRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..", "..", "..");
}

function resolveFromRoot(filePath: string): string {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(getBlackBeanSproutsRoot(), filePath);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getClaudeRuntimeRoot(): string {
  return resolveFromRoot(process.env.CLAUDE_CODE_LOCAL_ROOT?.trim() || ".claude-runtime");
}

function getClaudeNpmRoot(): string {
  return path.join(getClaudeRuntimeRoot(), "npm");
}

function getClaudeHomeDir(): string {
  return path.join(getClaudeRuntimeRoot(), "home");
}

function getClaudeSessionsDir(): string {
  return path.join(getClaudeRuntimeRoot(), "sessions");
}

function getClaudeSessionStorePath(): string {
  return path.join(getClaudeSessionsDir(), "sessions.json");
}

function getClaudeBinaryPath(): string {
  const configured = normalizeOptionalString(process.env.CLAUDE_CODE_BIN);
  if (configured) {
    return resolveFromRoot(configured);
  }

  const binaryName = process.platform === "win32" ? "claude.cmd" : "claude";
  return path.join(getClaudeNpmRoot(), "node_modules", ".bin", binaryName);
}

function getClaudeWorkspaceDir(): string {
  return resolveFromRoot(process.env.CLAUDE_CODE_WORKSPACE_DIR?.trim() || ".");
}

function getClaudeTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.CLAUDE_CODE_TIMEOUT_MS?.trim() || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function getClaudeModel(): string | undefined {
  return normalizeOptionalString(process.env.CLAUDE_CODE_MODEL);
}

function getClaudeBaseUrl(): string | undefined {
  return (
    normalizeOptionalString(process.env.CLAUDE_CODE_BASE_URL) ??
    normalizeOptionalString(process.env.DEEPSEEK_ANTHROPIC_BASE_URL) ??
    normalizeOptionalString(process.env.PACKY_API_BASE_URL) ??
    normalizeOptionalString(process.env.ANTHROPIC_BASE_URL)
  );
}

function getClaudeAuthToken(): string | undefined {
  return (
    normalizeOptionalString(process.env.CLAUDE_CODE_AUTH_TOKEN) ??
    normalizeOptionalString(process.env.DEEPSEEK_API_KEY) ??
    normalizeOptionalString(process.env.PACKY_API_KEY) ??
    normalizeOptionalString(process.env.ANTHROPIC_AUTH_TOKEN)
  );
}

function buildClaudeModelEnv(): Record<string, string> {
  const primaryModel = getClaudeModel();
  return {
    ...(primaryModel
      ? {
          ANTHROPIC_MODEL: primaryModel,
          ANTHROPIC_DEFAULT_OPUS_MODEL: primaryModel,
          ANTHROPIC_DEFAULT_SONNET_MODEL: primaryModel,
        }
      : {}),
    ...(normalizeOptionalString(process.env.CLAUDE_CODE_HAIKU_MODEL)
      ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: normalizeOptionalString(process.env.CLAUDE_CODE_HAIKU_MODEL)! }
      : {}),
    ...(normalizeOptionalString(process.env.CLAUDE_CODE_SUBAGENT_MODEL)
      ? { CLAUDE_CODE_SUBAGENT_MODEL: normalizeOptionalString(process.env.CLAUDE_CODE_SUBAGENT_MODEL)! }
      : {}),
    ...(normalizeOptionalString(process.env.CLAUDE_CODE_EFFORT_LEVEL)
      ? { CLAUDE_CODE_EFFORT_LEVEL: normalizeOptionalString(process.env.CLAUDE_CODE_EFFORT_LEVEL)! }
      : {}),
  };
}

async function ensureClaudeEnvironment(): Promise<void> {
  const claudeBin = getClaudeBinaryPath();
  const homeDir = getClaudeHomeDir();
  await fs.promises.mkdir(homeDir, { recursive: true });
  await fs.promises.mkdir(getClaudeSessionsDir(), { recursive: true });
  await ensureProjectLocalClaudeOnboarding(homeDir);

  try {
    await fs.promises.access(claudeBin, fs.constants.X_OK);
  } catch {
    throw new Error(
      [
        `Project-local Claude Code binary is missing at ${claudeBin}.`,
        "Run `npm run setup:claude-code` from the repository root.",
        "This project intentionally does not call a globally installed `claude` binary.",
      ].join("\n"),
    );
  }
}

async function ensureProjectLocalClaudeOnboarding(homeDir: string): Promise<void> {
  const statePath = path.join(homeDir, ".claude.json");
  let state: Record<string, unknown> = {};

  try {
    const raw = await fs.promises.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      state = parsed as Record<string, unknown>;
    }
  } catch {
    state = {};
  }

  if (state.hasCompletedOnboarding === true) {
    return;
  }

  await fs.promises.writeFile(
    statePath,
    `${JSON.stringify({ ...state, hasCompletedOnboarding: true }, null, 2)}\n`,
    "utf8",
  );
}

function ensureSafeSessionId(value: string): string {
  const trimmed = value.trim();
  if (SAFE_SESSION_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const digest = createHash("sha256").update(trimmed).digest("hex").slice(0, 24);
  return `bbs-${digest}`;
}

function normalizeSessionKey(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  return `claude-code:${createHash("sha256").update(normalized).digest("hex").slice(0, 32)}`;
}

async function loadSessionStore(): Promise<ClaudeSessionStore> {
  try {
    const raw = await fs.promises.readFile(getClaudeSessionStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ClaudeSessionStore;
  } catch {
    return {};
  }
}

async function saveSessionStore(store: ClaudeSessionStore): Promise<void> {
  const storePath = getClaudeSessionStorePath();
  await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
  await fs.promises.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function resolveClaudeSession(params: {
  sessionId?: string;
  sessionKey?: string;
}): Promise<{ sessionId?: string; sessionKey?: string }> {
  const explicitSessionId = normalizeOptionalString(params.sessionId);
  const sessionKey = normalizeSessionKey(params.sessionKey);
  if (explicitSessionId) {
    return { sessionId: ensureSafeSessionId(explicitSessionId), sessionKey };
  }
  if (!sessionKey) {
    return {};
  }

  const store = await loadSessionStore();
  const storedSessionId = normalizeOptionalString(store[sessionKey]?.sessionId);
  return {
    sessionId: storedSessionId ? ensureSafeSessionId(storedSessionId) : undefined,
    sessionKey,
  };
}

async function rememberClaudeSession(sessionKey: string | undefined, value: unknown): Promise<void> {
  const sessionId = readNestedString(value, ["session_id"]) ?? readNestedString(value, ["sessionId"]);
  if (!sessionKey || !sessionId) {
    return;
  }

  const store = await loadSessionStore();
  store[sessionKey] = {
    sessionId: ensureSafeSessionId(sessionId),
    updatedAt: Date.now(),
  };
  await saveSessionStore(store);
}

function readNestedString(value: unknown, pathSegments: readonly string[]): string | undefined {
  let current = value;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? normalizeOptionalString(current) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readTextFromContent(value: unknown): string | undefined {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => readTextFromContent(item))
      .filter((item): item is string => Boolean(item))
      .join("");
    return normalizeOptionalString(joined);
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const directText =
    (typeof record.text === "string" ? record.text : undefined) ??
    (typeof record.delta === "string" ? record.delta : undefined) ??
    (typeof record.result === "string" ? record.result : undefined);
  if (directText) {
    return normalizeOptionalString(directText);
  }

  return (
    readTextFromContent(record.content) ??
    readTextFromContent(record.message) ??
    readTextFromContent(record.data)
  );
}

function isClaudeError(value: unknown): boolean {
  const record = asRecord(value);
  return record?.is_error === true || record?.isError === true || record?.type === "error";
}

function readClaudeError(value: unknown): string | undefined {
  return (
    readNestedString(value, ["error", "message"]) ??
    readNestedString(value, ["message"]) ??
    readNestedString(value, ["result"])
  );
}

function buildClaudeArgs(params: {
  prompt: string;
  mode: ClaudeRunMode;
  resumeSessionId?: string;
  documentMode?: boolean;
}): string[] {
  const args = ["-p", params.prompt, "--output-format", params.mode];
  if (params.mode === "stream-json") {
    args.push("--verbose");
  }

  const model = getClaudeModel();
  if (model) {
    args.push("--model", model);
  }

  const maxTurns = normalizeOptionalString(process.env.CLAUDE_CODE_MAX_TURNS);
  if (maxTurns) {
    args.push("--max-turns", maxTurns);
  }

  if (params.resumeSessionId) {
    args.push("--resume", params.resumeSessionId);
  }

  const permissionMode = normalizeOptionalString(process.env.CLAUDE_CODE_PERMISSION_MODE);
  if (permissionMode) {
    args.push("--permission-mode", permissionMode);
  }

  if (params.documentMode) {
    args.push("--allowedTools", "Read", "Write", "Edit", "MultiEdit");
  } else {
    args.push("--disallowedTools", "Bash", "Write", "Edit", "MultiEdit");
  }

  return args;
}

async function runClaudeCode(params: {
  prompt: string;
  mode: ClaudeRunMode;
  cwd?: string;
  sessionId?: string;
  sessionKey?: string;
  documentMode?: boolean;
  abortSignal?: AbortSignal;
  onJsonValue?: (value: unknown) => Promise<void> | void;
}): Promise<ClaudeRunOutput> {
  await ensureClaudeEnvironment();

  const claudeBin = getClaudeBinaryPath();
  const homeDir = getClaudeHomeDir();
  const runtimeRoot = getClaudeRuntimeRoot();
  const jsonValues: unknown[] = [];
  const args = buildClaudeArgs({
    prompt: params.prompt,
    mode: params.mode,
    resumeSessionId: params.sessionId,
    documentMode: params.documentMode,
  });
  const env = {
    ...process.env,
    CLAUDE_CODE_BIN: claudeBin,
    HOME: homeDir,
    XDG_CONFIG_HOME: path.join(homeDir, ".config"),
    npm_config_cache: path.join(runtimeRoot, "npm-cache"),
    ...(getClaudeBaseUrl() ? { ANTHROPIC_BASE_URL: getClaudeBaseUrl() } : {}),
    ...(getClaudeAuthToken() ? { ANTHROPIC_AUTH_TOKEN: getClaudeAuthToken() } : {}),
    ...buildClaudeModelEnv(),
    CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
  };

  await fs.promises.mkdir(params.cwd ?? getClaudeWorkspaceDir(), { recursive: true });

  return new Promise<ClaudeRunOutput>((resolve, reject) => {
    const child = spawn("bash", ["-lc", 'exec "$CLAUDE_CODE_BIN" "$@"', "claude-code-local", ...args], {
      cwd: params.cwd ?? getClaudeWorkspaceDir(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, getClaudeTimeoutMs());

    const abort = () => {
      child.kill("SIGTERM");
    };
    params.abortSignal?.addEventListener("abort", abort, { once: true });

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        jsonValues.push(parsed);
        void Promise.resolve(params.onJsonValue?.(parsed)).catch(() => undefined);
      } catch {
        // Claude may write non-JSON diagnostics to stdout. Keep them in stdout for error reporting.
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      stdoutBuffer += text;
      let newlineIndex = stdoutBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        handleLine(line);
        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      params.abortSignal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      params.abortSignal?.removeEventListener("abort", abort);
      handleLine(stdoutBuffer);

      for (const value of jsonValues) {
        await rememberClaudeSession(params.sessionKey, value).catch(() => undefined);
      }

      if (timedOut) {
        reject(new Error(`Claude Code timed out after ${getClaudeTimeoutMs()}ms.`));
        return;
      }
      if (code !== 0) {
        const detail = normalizeOptionalString(stderr) ?? normalizeOptionalString(stdout);
        reject(new Error(detail ? `Claude Code exited with ${code}: ${detail}` : `Claude Code exited with ${code}.`));
        return;
      }

      resolve({ stdout, stderr, jsonValues });
    });
  });
}

export async function runClaudeCodeTextPrompt(params: {
  message: string;
  sessionId?: string;
  sessionKey?: string;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const resolvedSession = await resolveClaudeSession({
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
  });
  const output = await runClaudeCode({
    prompt: params.message,
    mode: "json",
    sessionId: resolvedSession.sessionId,
    sessionKey: resolvedSession.sessionKey,
    abortSignal: params.abortSignal,
  });

  const lastJson = output.jsonValues.at(-1);
  if (lastJson && isClaudeError(lastJson)) {
    throw new Error(readClaudeError(lastJson) ?? "Claude Code returned an error.");
  }

  const jsonText = readTextFromContent(lastJson);
  const fallbackText = normalizeOptionalString(output.stdout);
  const text = jsonText ?? fallbackText;
  if (!text) {
    throw new Error("Claude Code returned no assistant text.");
  }
  return text;
}

export function createClaudeCodeAgentRunner(): OpenClawAgentRunner {
  return async ({ message, sessionId, sessionKey, documentId, abortSignal, onEvent }) => {
    const resolvedSession = await resolveClaudeSession({ sessionId, sessionKey });
    const runId = `bbs-claude-code-${randomUUID()}`;
    const documentWorkspace = documentId
      ? resolveAgentDocumentWorkspacePaths({
          documentId,
          sessionKey: resolvedSession.sessionKey,
        })
      : undefined;
    const prompt = documentWorkspace
      ? buildAgentDocumentPrompt({
          userMessage: message,
          documentPath: path.basename(documentWorkspace.documentPath),
          previewPath: path.basename(documentWorkspace.previewPath),
          instructionsPath: path.basename(documentWorkspace.instructionsPath),
        })
      : message;
    const cwd = documentWorkspace?.workspaceDir ?? getClaudeWorkspaceDir();
    let nextSeq = 0;
    let assistantText = "";
    let sawResult = false;

    const emitEvent = (stream: string, data: Record<string, unknown>) => {
      const rawEvent: OpenClawRawEvent = {
        runId,
        seq: nextSeq++,
        stream,
        ts: Date.now(),
        data,
        sessionKey: resolvedSession.sessionKey,
      };
      onEvent(rawEvent);
    };

    emitEvent("lifecycle", { phase: "start", provider: "claude-code" });

    try {
      await runClaudeCode({
        prompt,
        mode: "stream-json",
        cwd,
        sessionId: resolvedSession.sessionId,
        sessionKey: resolvedSession.sessionKey,
        documentMode: Boolean(documentWorkspace),
        abortSignal,
        onJsonValue: (value) => {
          const record = asRecord(value);
          const type = typeof record?.type === "string" ? record.type : undefined;

          if (record?.session_id || record?.sessionId) {
            emitEvent("item", {
              type: "session",
              sessionId: readNestedString(record, ["session_id"]) ?? readNestedString(record, ["sessionId"]),
            });
          }

          if (isClaudeError(value)) {
            emitEvent("lifecycle", {
              phase: "error",
              error: readClaudeError(value) ?? "Claude Code returned an error.",
            });
            sawResult = true;
            return;
          }

          if (type === "system") {
            emitEvent("item", {
              type: "system",
              subtype: typeof record?.subtype === "string" ? record.subtype : undefined,
            });
            return;
          }

          const nextText = readTextFromContent(value);
          if (type === "assistant" && nextText) {
            const previousText = assistantText;
            const delta = nextText.startsWith(previousText)
              ? nextText.slice(previousText.length)
              : nextText;
            assistantText = nextText.startsWith(previousText) ? nextText : previousText + nextText;
            emitEvent("assistant", {
              phase: "delta",
              delta,
              fullText: assistantText,
            });
            return;
          }

          if (type === "result") {
            sawResult = true;
            const finalText = nextText ?? assistantText;
            emitEvent("assistant", {
              phase: "end",
              fullText: finalText,
            });
            emitEvent("lifecycle", { phase: "end", provider: "claude-code" });
            return;
          }

          if (type === "tool_use") {
            emitEvent("tool", {
              phase: "start",
              toolName: readNestedString(value, ["name"]) ?? "claude_tool",
              input: record,
            });
            return;
          }

          if (type === "tool_result") {
            emitEvent("tool", {
              phase: "end",
              toolName: readNestedString(value, ["name"]) ?? "claude_tool",
              output: record,
            });
          }
        },
      });

      if (!sawResult) {
        emitEvent("assistant", {
          phase: "end",
          fullText: assistantText,
        });
        emitEvent("lifecycle", { phase: "end", provider: "claude-code" });
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      emitEvent("lifecycle", { phase: "error", error: messageText, provider: "claude-code" });
      throw error;
    }
  };
}
