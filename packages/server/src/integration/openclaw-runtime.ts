import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { OpenClawAgentRunner, OpenClawRawEvent } from "@black-bean-sprouts/xiaolongxia-kernel";
import { ensureCanonicalOpenClawConfig, type OpenClawConfig } from "./openclaw-config.js";

type OpenClawSessionEntry = {
  sessionId?: string;
  sessionFile?: string;
  updatedAt?: number;
  [key: string]: unknown;
};

type OpenClawSessionStore = Record<string, OpenClawSessionEntry>;

type OpenClawRunResult = {
  payloads?: Array<{
    text?: string;
    isError?: boolean;
    isReasoning?: boolean;
  }>;
  meta?: {
    finalAssistantVisibleText?: string;
  };
};

type OpenClawCoreModule = {
  loadConfig?: () => OpenClawConfig;
  loadSessionStore?: (storePath: string) => OpenClawSessionStore;
  saveSessionStore?: (
    storePath: string,
    store: OpenClawSessionStore,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  resolveStorePath?: (store?: string, opts?: { agentId?: string }) => string;
};

type OpenClawExtensionModule = {
  resolveAgentDir?: (config: OpenClawConfig, agentId?: string) => string;
  resolveSessionFilePath?: (sessionId: string, entry?: { sessionFile?: string }) => string;
  runEmbeddedPiAgent?: (params: Record<string, unknown>) => Promise<OpenClawRunResult>;
};

type LoadedOpenClawRuntime = {
  readonly source: string;
  readonly projectPath: string;
  readonly workspaceDir: string;
  readonly loadConfig: () => OpenClawConfig;
  readonly loadSessionStore?: OpenClawCoreModule["loadSessionStore"];
  readonly saveSessionStore?: OpenClawCoreModule["saveSessionStore"];
  readonly resolveStorePath?: OpenClawCoreModule["resolveStorePath"];
  readonly resolveAgentDir: NonNullable<OpenClawExtensionModule["resolveAgentDir"]>;
  readonly resolveSessionFilePath?: OpenClawExtensionModule["resolveSessionFilePath"];
  readonly runEmbeddedPiAgent: NonNullable<OpenClawExtensionModule["runEmbeddedPiAgent"]>;
};

type OpenClawModuleCandidate = {
  readonly label: string;
  readonly projectPath: string;
  readonly corePath: string;
  readonly extensionApiPath: string;
};

const OPENCLAW_AGENT_ID = "main";
const DEFAULT_TIMEOUT_MS = 60_000;
const SAFE_SESSION_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

let loadedRuntimePromise: Promise<LoadedOpenClawRuntime> | undefined;

function logOpenClawDebug(...args: unknown[]): void {
  if (process.env.BBS_OPENCLAW_DEBUG === "1") {
    console.log("[bbs-openclaw]", ...args);
  }
}

function isTsxRuntime(): boolean {
  const haystack = [process.argv[0], ...process.execArgv].join(" ").toLowerCase();
  return haystack.includes("tsx");
}

function toImportHref(filePath: string): string {
  return pathToFileURL(filePath).href;
}

function pathExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getBlackBeanSproutsRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..", "..", "..");
}

function resolveFromBlackBeanSproutsRoot(filePath: string): string {
  return path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.resolve(getBlackBeanSproutsRoot(), filePath);
}

function getDefaultOpenClawProjectPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "reference_projects", "openclaw"),
    path.resolve(process.cwd(), "..", "reference_projects", "openclaw"),
    path.resolve(getBlackBeanSproutsRoot(), "..", "reference_projects", "openclaw"),
  ];

  for (const candidate of candidates) {
    if (
      pathExists(path.join(candidate, "dist", "index.js")) ||
      pathExists(path.join(candidate, "src", "index.ts"))
    ) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1]!;
}

function getOpenClawProjectPath(): string {
  const configuredPath = process.env.OPENCLAW_PROJECT_PATH?.trim();
  if (configuredPath) {
    return resolveFromBlackBeanSproutsRoot(configuredPath);
  }
  return getDefaultOpenClawProjectPath();
}

function getDefaultOpenClawStateDir(): string {
  return path.join(getBlackBeanSproutsRoot(), ".openclaw-runtime");
}

function getConfiguredOpenClawStateDir(): string {
  const configuredStateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  if (configuredStateDir) {
    return resolveFromBlackBeanSproutsRoot(configuredStateDir);
  }
  return getDefaultOpenClawStateDir();
}

function getConfiguredOpenClawConfigPath(stateDir: string): string {
  const configuredConfigPath = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (configuredConfigPath) {
    return resolveFromBlackBeanSproutsRoot(configuredConfigPath);
  }
  return path.join(stateDir, "openclaw.json");
}

function getConfiguredWorkspaceDir(): string {
  const configuredWorkspaceDir = process.env.OPENCLAW_WORKSPACE_DIR?.trim();
  if (configuredWorkspaceDir) {
    return resolveFromBlackBeanSproutsRoot(configuredWorkspaceDir);
  }
  return getBlackBeanSproutsRoot();
}

function getConfiguredTimeoutMs(): number {
  const raw = process.env.OPENCLAW_TIMEOUT_MS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function ensureOpenClawEnvironment(): Promise<void> {
  const stateDir = getConfiguredOpenClawStateDir();
  const configPath = getConfiguredOpenClawConfigPath(stateDir);
  const workspaceDir = getConfiguredWorkspaceDir();
  const hasExplicitStateDir = Boolean(process.env.OPENCLAW_STATE_DIR?.trim());
  const hasExplicitConfigPath = Boolean(process.env.OPENCLAW_CONFIG_PATH?.trim());

  process.env.OPENCLAW_STATE_DIR ??= stateDir;
  process.env.OPENCLAW_CONFIG_PATH ??= configPath;
  process.env.OPENCLAW_WORKSPACE_DIR ??= workspaceDir;
  process.env.OPENCLAW_SUPPRESS_EXTENSION_API_WARNING ??= "1";
  process.env.OPENCLAW_DISABLE_PLUGIN_DISCOVERY_CACHE ??= "1";
  process.env.OPENCLAW_DISABLE_PLUGIN_MANIFEST_CACHE ??= "1";
  process.env.OPENCLAW_PLUGIN_DISCOVERY_CACHE_MS ??= "0";
  process.env.OPENCLAW_PLUGIN_MANIFEST_CACHE_MS ??= "0";

  await fs.promises.mkdir(stateDir, { recursive: true });
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });

  if (hasExplicitStateDir && hasExplicitConfigPath) {
    return;
  }

  try {
    await fs.promises.access(configPath, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(configPath, JSON.stringify({ plugins: {} }, null, 2), "utf8");
  }

  await ensureCanonicalOpenClawConfig({
    configPath,
    workspaceDir,
  });
}

function getModuleCandidates(projectPath: string): OpenClawModuleCandidate[] {
  const candidates: OpenClawModuleCandidate[] = [
    {
      label: "dist",
      projectPath,
      corePath: path.join(projectPath, "dist", "index.js"),
      extensionApiPath: path.join(projectPath, "dist", "extensionAPI.js"),
    },
  ];

  if (isTsxRuntime()) {
    candidates.push({
      label: "source",
      projectPath,
      corePath: path.join(projectPath, "src", "index.ts"),
      extensionApiPath: path.join(projectPath, "src", "extensionAPI.ts"),
    });
  }

  return candidates;
}

async function loadOpenClawRuntime(): Promise<LoadedOpenClawRuntime> {
  loadedRuntimePromise ??= (async () => {
    const projectPath = getOpenClawProjectPath();
    const workspaceDir = getConfiguredWorkspaceDir();
    const failures: string[] = [];
    await ensureOpenClawEnvironment();

    for (const candidate of getModuleCandidates(projectPath)) {
      try {
        const [coreModule, extensionModule] = await Promise.all([
          import(toImportHref(candidate.corePath)) as Promise<OpenClawCoreModule>,
          import(toImportHref(candidate.extensionApiPath)) as Promise<OpenClawExtensionModule>,
        ]);

        if (typeof coreModule.loadConfig !== "function") {
          failures.push(`${candidate.label}: missing loadConfig export at ${candidate.corePath}`);
          continue;
        }
        if (typeof extensionModule.resolveAgentDir !== "function") {
          failures.push(
            `${candidate.label}: missing resolveAgentDir export at ${candidate.extensionApiPath}`,
          );
          continue;
        }
        if (typeof extensionModule.runEmbeddedPiAgent !== "function") {
          failures.push(
            `${candidate.label}: missing runEmbeddedPiAgent export at ${candidate.extensionApiPath}`,
          );
          continue;
        }

        return {
          source: candidate.label,
          projectPath: candidate.projectPath,
          workspaceDir,
          loadConfig: () => coreModule.loadConfig!(),
          loadSessionStore:
            typeof coreModule.loadSessionStore === "function"
              ? (storePath) => coreModule.loadSessionStore!(storePath)
              : undefined,
          saveSessionStore:
            typeof coreModule.saveSessionStore === "function"
              ? (storePath, store, opts) => coreModule.saveSessionStore!(storePath, store, opts)
              : undefined,
          resolveStorePath:
            typeof coreModule.resolveStorePath === "function"
              ? (store, opts) => coreModule.resolveStorePath!(store, opts)
              : undefined,
          resolveAgentDir: (config, agentId) => extensionModule.resolveAgentDir!(config, agentId),
          resolveSessionFilePath:
            typeof extensionModule.resolveSessionFilePath === "function"
              ? (sessionId, entry) => extensionModule.resolveSessionFilePath!(sessionId, entry)
              : undefined,
          runEmbeddedPiAgent: (params) => extensionModule.runEmbeddedPiAgent!(params),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${candidate.label}: ${message}`);
      }
    }

    throw new Error(
      [
        `Unable to load OpenClaw runtime from ${projectPath}.`,
        "Set OPENCLAW_PROJECT_PATH to the OpenClaw repo root and ensure its runtime is available.",
        "For the real kernel path, install and build OpenClaw first: `pnpm install` then `pnpm build` inside that repo.",
        "OpenClaw currently targets Node >= 22.14.0.",
        ...failures.map((failure) => `- ${failure}`),
      ].join("\n"),
    );
  })();

  return loadedRuntimePromise;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readNestedString(
  value: Record<string, unknown>,
  segments: readonly string[],
): string | undefined {
  let current: unknown = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? normalizeOptionalString(current) : undefined;
}

function splitProviderModel(
  value: string | undefined,
): { provider?: string; model?: string } | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= normalized.length - 1) {
    return { model: normalized };
  }
  return {
    provider: normalizeOptionalString(normalized.slice(0, slashIndex)),
    model: normalizeOptionalString(normalized.slice(slashIndex + 1)),
  };
}

function resolveConfiguredModelSelection(config: OpenClawConfig): {
  provider?: string;
  model?: string;
} {
  const envModel = splitProviderModel(process.env.OPENCLAW_MODEL);
  const envProvider = normalizeOptionalString(process.env.OPENCLAW_PROVIDER);
  if (envModel?.model || envProvider) {
    return {
      provider: envProvider ?? envModel?.provider,
      model: envModel?.model,
    };
  }

  const configuredPrimary =
    readNestedString(config, ["agents", OPENCLAW_AGENT_ID, "model", "primary"]) ??
    readNestedString(config, ["agents", "defaults", "model", "primary"]);
  return splitProviderModel(configuredPrimary) ?? {};
}

function ensureSafeSessionId(value: string): string {
  const trimmed = value.trim();
  if (SAFE_SESSION_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const digest = createHash("sha256").update(trimmed).digest("hex").slice(0, 24);
  return `bbs-${digest}`;
}

function deriveSessionIdFromKey(sessionKey: string): string {
  return ensureSafeSessionId(`bbs-${createHash("sha256").update(sessionKey).digest("hex").slice(0, 24)}`);
}

function normalizeSessionKey(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith(`agent:${OPENCLAW_AGENT_ID}:`)) {
    return normalized;
  }
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `agent:${OPENCLAW_AGENT_ID}:probe:${digest}`;
}

function resolveStorePath(runtime: LoadedOpenClawRuntime): string {
  if (typeof runtime.resolveStorePath === "function") {
    return runtime.resolveStorePath(undefined, { agentId: OPENCLAW_AGENT_ID });
  }
  return path.join(
    getConfiguredOpenClawStateDir(),
    "agents",
    OPENCLAW_AGENT_ID,
    "sessions",
    "sessions.json",
  );
}

function loadSessionStore(runtime: LoadedOpenClawRuntime, storePath: string): OpenClawSessionStore {
  if (typeof runtime.loadSessionStore !== "function") {
    return {};
  }
  try {
    return runtime.loadSessionStore(storePath) ?? {};
  } catch {
    return {};
  }
}

async function persistSessionStore(
  runtime: LoadedOpenClawRuntime,
  storePath: string,
  store: OpenClawSessionStore,
  sessionKey: string,
): Promise<void> {
  if (typeof runtime.saveSessionStore !== "function") {
    return;
  }
  await runtime.saveSessionStore(storePath, store, {
    activeSessionKey: sessionKey,
  });
}

function resolveSessionFilePath(
  runtime: LoadedOpenClawRuntime,
  sessionId: string,
  entry?: { sessionFile?: string },
): string {
  if (typeof runtime.resolveSessionFilePath === "function") {
    return runtime.resolveSessionFilePath(sessionId, entry);
  }
  return path.join(
    getConfiguredOpenClawStateDir(),
    "agents",
    OPENCLAW_AGENT_ID,
    "sessions",
    `${sessionId}.jsonl`,
  );
}

async function resolveOpenClawSession(params: {
  runtime: LoadedOpenClawRuntime;
  sessionId?: string;
  sessionKey?: string;
}): Promise<{ sessionId: string; sessionKey?: string; sessionFile: string }> {
  const resolvedSessionKey = normalizeSessionKey(params.sessionKey);
  const explicitSessionId = normalizeOptionalString(params.sessionId);
  const storePath = resolveStorePath(params.runtime);
  const sessionStore = resolvedSessionKey
    ? loadSessionStore(params.runtime, storePath)
    : undefined;
  const existingEntry = resolvedSessionKey ? sessionStore?.[resolvedSessionKey] : undefined;
  const persistedSessionId = normalizeOptionalString(existingEntry?.sessionId);
  const resolvedSessionId = explicitSessionId
    ? ensureSafeSessionId(explicitSessionId)
    : persistedSessionId
      ? ensureSafeSessionId(persistedSessionId)
      : resolvedSessionKey
        ? deriveSessionIdFromKey(resolvedSessionKey)
        : ensureSafeSessionId(`bbs-${randomUUID()}`);
  const sessionFile = resolveSessionFilePath(params.runtime, resolvedSessionId, existingEntry);

  await fs.promises.mkdir(path.dirname(sessionFile), { recursive: true });

  if (resolvedSessionKey && sessionStore) {
    sessionStore[resolvedSessionKey] = {
      ...existingEntry,
      sessionId: resolvedSessionId,
      sessionFile,
      updatedAt: Date.now(),
    };
    await persistSessionStore(params.runtime, storePath, sessionStore, resolvedSessionKey).catch(
      () => undefined,
    );
  }

  return {
    sessionId: resolvedSessionId,
    sessionKey: resolvedSessionKey,
    sessionFile,
  };
}

function toEventData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function resolveAssistantFinalText(params: {
  result: OpenClawRunResult;
  assistantText: string;
}): string {
  const metaText = normalizeOptionalString(params.result.meta?.finalAssistantVisibleText);
  if (metaText) {
    return metaText;
  }

  const payloadText = params.result.payloads
    ?.filter((payload) => !payload.isReasoning && !payload.isError)
    .map((payload) => normalizeOptionalString(payload.text))
    .filter((payload): payload is string => Boolean(payload))
    .at(-1);
  if (payloadText) {
    return payloadText;
  }

  return params.assistantText;
}

export async function runOpenClawTextPrompt(params: {
  message: string;
  sessionId?: string;
  sessionKey?: string;
  abortSignal?: AbortSignal;
}): Promise<string> {
  logOpenClawDebug("text-prompt:start");
  const runtime = await loadOpenClawRuntime();
  logOpenClawDebug("text-prompt:runtime-loaded", {
    source: runtime.source,
    projectPath: runtime.projectPath,
    workspaceDir: runtime.workspaceDir,
  });
  const resolvedSession = await resolveEphemeralTextSession({
    runtime,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
  });
  logOpenClawDebug("text-prompt:session-ready", resolvedSession);
  const runId = `bbs-openclaw-${randomUUID()}`;
  const config = runtime.loadConfig();
  const agentDir = runtime.resolveAgentDir(config, OPENCLAW_AGENT_ID);
  const modelSelection = resolveConfiguredModelSelection(config);
  logOpenClawDebug("text-prompt:before-run", {
    runId,
    agentDir,
    provider: modelSelection.provider,
    model: modelSelection.model,
  });
  let assistantText = "";

  const result = await runtime.runEmbeddedPiAgent({
    sessionId: resolvedSession.sessionId,
    sessionKey: resolvedSession.sessionKey,
    agentId: OPENCLAW_AGENT_ID,
    trigger: "user",
    senderIsOwner: false,
    sessionFile: resolvedSession.sessionFile,
    workspaceDir: runtime.workspaceDir,
    agentDir,
    config,
    prompt: params.message,
    ...(modelSelection.provider ? { provider: modelSelection.provider } : {}),
    ...(modelSelection.model ? { model: modelSelection.model } : {}),
    disableTools: true,
    toolsAllow: ["read"],
    thinkLevel: "off",
    verboseLevel: "off",
    timeoutMs: getConfiguredTimeoutMs(),
    runId,
    abortSignal: params.abortSignal,
    bootstrapContextMode: "lightweight",
    cleanupBundleMcpOnRunEnd: true,
    onAgentEvent: (event: { stream: string; data: Record<string, unknown> }) => {
      logOpenClawDebug("text-prompt:event", event.stream);
      if (event.stream !== "assistant") {
        return;
      }
      const data = toEventData(event.data);
      const nextText = typeof data.text === "string" ? data.text : "";
      const nextDelta = typeof data.delta === "string" ? data.delta : "";
      const replace = data.replace === true;

      if (replace) {
        assistantText = nextText || nextDelta;
        return;
      }
      if (nextText && (!assistantText || nextText.startsWith(assistantText))) {
        assistantText = nextText;
        return;
      }
      if (nextDelta) {
        assistantText += nextDelta;
        return;
      }
      if (nextText) {
        assistantText = nextText;
      }
    },
  });
  logOpenClawDebug("text-prompt:after-run", result.meta?.finalAssistantVisibleText ?? "");

  return resolveAssistantFinalText({ result, assistantText });
}

async function resolveEphemeralTextSession(params: {
  runtime: LoadedOpenClawRuntime;
  sessionId?: string;
  sessionKey?: string;
}): Promise<{ sessionId: string; sessionKey?: string; sessionFile: string }> {
  const resolvedSessionId = normalizeOptionalString(params.sessionId)
    ? ensureSafeSessionId(params.sessionId!)
    : ensureSafeSessionId(`probe-${randomUUID()}`);
  const resolvedSessionKey = normalizeSessionKey(params.sessionKey);
  const sessionFile = resolveSessionFilePath(params.runtime, resolvedSessionId);
  await fs.promises.mkdir(path.dirname(sessionFile), { recursive: true });

  return {
    sessionId: resolvedSessionId,
    sessionKey: resolvedSessionKey,
    sessionFile,
  };
}

export function createRealOpenClawAgentRunner(): OpenClawAgentRunner {
  return async ({ message, sessionId, sessionKey, abortSignal, onEvent }) => {
    const runtime = await loadOpenClawRuntime();
    const resolvedSession = await resolveOpenClawSession({
      runtime,
      sessionId,
      sessionKey,
    });
    const runId = `bbs-openclaw-${randomUUID()}`;
    const config = runtime.loadConfig();
    const agentDir = runtime.resolveAgentDir(config, OPENCLAW_AGENT_ID);
    const modelSelection = resolveConfiguredModelSelection(config);
    let nextSeq = 0;
    let assistantText = "";
    let sawAssistantEvent = false;
    let terminalLifecycleData: Record<string, unknown> | undefined;

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

    emitEvent("lifecycle", { phase: "start" });

    try {
      const result = await runtime.runEmbeddedPiAgent({
        sessionId: resolvedSession.sessionId,
        sessionKey: resolvedSession.sessionKey,
        agentId: OPENCLAW_AGENT_ID,
        trigger: "user",
        senderIsOwner: false,
        sessionFile: resolvedSession.sessionFile,
        workspaceDir: runtime.workspaceDir,
        agentDir,
        config,
        prompt: message,
        ...(modelSelection.provider ? { provider: modelSelection.provider } : {}),
        ...(modelSelection.model ? { model: modelSelection.model } : {}),
        timeoutMs: getConfiguredTimeoutMs(),
        runId,
        abortSignal,
        bootstrapContextMode: "lightweight",
        cleanupBundleMcpOnRunEnd: true,
        onAgentEvent: (event: { stream: string; data: Record<string, unknown> }) => {
          const stream = typeof event?.stream === "string" ? event.stream : "lifecycle";
          const data = toEventData(event?.data);

          if (stream === "lifecycle") {
            const phase = normalizeOptionalString(
              typeof data.phase === "string" ? data.phase : undefined,
            );
            if (phase === "end" || phase === "error") {
              terminalLifecycleData = { phase, ...data };
            }
            return;
          }

          if (stream === "assistant") {
            const nextText = typeof data.text === "string" ? data.text : "";
            const nextDelta = typeof data.delta === "string" ? data.delta : "";
            const replace = data.replace === true;
            const previousText = assistantText;

            if (replace) {
              assistantText = nextText || nextDelta;
            } else if (nextText && (!previousText || nextText.startsWith(previousText))) {
              assistantText = nextText;
            } else if (nextDelta) {
              assistantText = previousText + nextDelta;
            } else if (nextText) {
              assistantText = nextText;
            }

            const delta =
              replace || !nextDelta
                ? assistantText.slice(replace ? 0 : previousText.length)
                : nextDelta;
            sawAssistantEvent = sawAssistantEvent || Boolean(delta || assistantText);

            emitEvent("assistant", {
              phase: "delta",
              delta,
              fullText: assistantText,
              ...(data.phase ? { assistantPhase: data.phase } : {}),
              ...(replace ? { replace: true } : {}),
              ...(Array.isArray(data.mediaUrls) ? { mediaUrls: data.mediaUrls } : {}),
            });
            return;
          }

          if (stream === "tool") {
            emitEvent("tool", {
              ...data,
              ...(typeof data.name === "string" && !("toolName" in data)
                ? { toolName: data.name }
                : {}),
            });
            return;
          }

          emitEvent(stream, data);
        },
      });

      const finalAssistantText = resolveAssistantFinalText({
        result,
        assistantText,
      });

      if (finalAssistantText || sawAssistantEvent) {
        emitEvent("assistant", {
          phase: "end",
          fullText: finalAssistantText,
        });
      }

      emitEvent("lifecycle", terminalLifecycleData ?? { phase: "end" });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      emitEvent("lifecycle", terminalLifecycleData ?? { phase: "error", error: messageText });
      throw error;
    }
  };
}
