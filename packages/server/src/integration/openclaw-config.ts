import fs from "node:fs";

export type OpenClawConfig = Record<string, unknown>;

type JsonRecord = Record<string, unknown>;

const DEFAULT_PROVIDER_ID = "siliconflow";
const DEFAULT_MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";
const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_API_KEY_ENV = "SILICONFLOW_API_KEY";
const DEFAULT_TIMEOUT_SECONDS = 20;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 12;
const DEFAULT_CONTEXT_WINDOW = 131_072;
const DEFAULT_MAX_TOKENS = 8_192;

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonRecord;
}

function splitProviderModel(value: string | undefined): { provider?: string; model?: string } | undefined {
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

function toEnvPrefix(providerId: string): string {
  return providerId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function toPortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function getBootstrapSelection(): { providerId: string; modelId: string; primaryModelKey: string } {
  const explicitPrimary =
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_PRIMARY_MODEL) ??
    normalizeOptionalString(process.env.OPENCLAW_MODEL);
  const explicitProvider =
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_PROVIDER) ??
    normalizeOptionalString(process.env.OPENCLAW_PROVIDER);
  const parsedPrimary = splitProviderModel(explicitPrimary);
  const providerId = explicitProvider ?? parsedPrimary?.provider ?? DEFAULT_PROVIDER_ID;
  const providerPrefix = toEnvPrefix(providerId);
  const modelId =
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_MODEL_ID) ??
    normalizeOptionalString(process.env[`${providerPrefix}_MODEL_ID`]) ??
    parsedPrimary?.model ??
    DEFAULT_MODEL_ID;
  const primaryModelKey =
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_PRIMARY_MODEL) ??
    (explicitPrimary && !explicitPrimary.includes("/") ? `${providerId}/${explicitPrimary}` : undefined) ??
    `${providerId}/${modelId}`;

  return {
    providerId,
    modelId,
    primaryModelKey,
  };
}

function getBootstrapBaseUrl(providerId: string): string {
  const providerPrefix = toEnvPrefix(providerId);
  return (
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_BASE_URL) ??
    normalizeOptionalString(process.env[`${providerPrefix}_BASE_URL`]) ??
    (providerId === DEFAULT_PROVIDER_ID ? DEFAULT_BASE_URL : "") ??
    DEFAULT_BASE_URL
  );
}

function getBootstrapApiKeyEnvVar(providerId: string): string {
  const providerPrefix = toEnvPrefix(providerId);
  return (
    normalizeOptionalString(process.env.OPENCLAW_BOOTSTRAP_API_KEY_ENV) ??
    normalizeOptionalString(process.env[`${providerPrefix}_API_KEY_ENV`]) ??
    normalizeOptionalString(process.env[`${providerPrefix}_API_KEY_VAR`]) ??
    (providerId === DEFAULT_PROVIDER_ID ? DEFAULT_API_KEY_ENV : `${providerPrefix}_API_KEY`)
  );
}

function buildCanonicalProviderConfig(params: {
  providerId: string;
  modelId: string;
  baseUrl: string;
  apiKeyEnvVar: string;
}): JsonRecord {
  return {
    baseUrl: params.baseUrl,
    apiKey: {
      source: "env",
      provider: "default",
      id: params.apiKeyEnvVar,
    },
    api: "openai-completions",
    authHeader: true,
    models: [
      {
        id: params.modelId,
        name: params.modelId,
        reasoning: false,
        input: ["text"],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxTokens: DEFAULT_MAX_TOKENS,
        compat: {
          requiresStringContent: true,
          supportsTools: false,
        },
      },
    ],
  };
}

function buildCanonicalConfig(params: { workspaceDir: string }): OpenClawConfig {
  const selection = getBootstrapSelection();
  const providerConfig = buildCanonicalProviderConfig({
    providerId: selection.providerId,
    modelId: selection.modelId,
    baseUrl: getBootstrapBaseUrl(selection.providerId),
    apiKeyEnvVar: getBootstrapApiKeyEnvVar(selection.providerId),
  });

  return {
    plugins: {},
    agents: {
      defaults: {
        workspace: toPortablePath(params.workspaceDir),
        timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        llm: {
          idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
        },
        model: {
          primary: selection.primaryModelKey,
        },
        models: {
          [selection.primaryModelKey]: {},
        },
      },
    },
    messages: {
      tts: {
        auto: "off",
      },
    },
    models: {
      mode: "replace",
      providers: {
        [selection.providerId]: providerConfig,
      },
    },
  };
}

function mergeCanonicalConfig(
  existingConfig: OpenClawConfig,
  canonicalConfig: OpenClawConfig,
): OpenClawConfig {
  const existing = asRecord(existingConfig) ?? {};
  const canonical = asRecord(canonicalConfig) ?? {};

  const existingPlugins = asRecord(existing.plugins);
  const canonicalPlugins = asRecord(canonical.plugins) ?? {};

  const existingAgents = asRecord(existing.agents) ?? {};
  const canonicalAgents = asRecord(canonical.agents) ?? {};
  const existingDefaults = asRecord(existingAgents.defaults) ?? {};
  const canonicalDefaults = asRecord(canonicalAgents.defaults) ?? {};
  const existingDefaultModel = asRecord(existingDefaults.model) ?? {};
  const canonicalDefaultModel = asRecord(canonicalDefaults.model) ?? {};
  const existingDefaultLlm = asRecord(existingDefaults.llm) ?? {};
  const canonicalDefaultLlm = asRecord(canonicalDefaults.llm) ?? {};
  const existingDefaultModels = asRecord(existingDefaults.models) ?? {};
  const canonicalDefaultModels = asRecord(canonicalDefaults.models) ?? {};

  const existingMessages = asRecord(existing.messages) ?? {};
  const canonicalMessages = asRecord(canonical.messages) ?? {};
  const existingTts = asRecord(existingMessages.tts) ?? {};
  const canonicalTts = asRecord(canonicalMessages.tts) ?? {};

  const existingModelsRoot = asRecord(existing.models) ?? {};
  const canonicalModelsRoot = asRecord(canonical.models) ?? {};
  const existingProviders = asRecord(existingModelsRoot.providers) ?? {};
  const canonicalProviders = asRecord(canonicalModelsRoot.providers) ?? {};

  const [canonicalProviderId, canonicalProviderConfig] =
    Object.entries(canonicalProviders)[0] ?? [];
  const existingCanonicalProvider =
    canonicalProviderId && Object.hasOwn(existingProviders, canonicalProviderId)
      ? asRecord(existingProviders[canonicalProviderId])
      : undefined;
  const mergedCanonicalProvider = canonicalProviderId
    ? {
        ...(asRecord(canonicalProviderConfig) ?? {}),
        ...(existingCanonicalProvider ?? {}),
        ...(typeof existingCanonicalProvider?.baseUrl === "string"
          ? {}
          : { baseUrl: (asRecord(canonicalProviderConfig) ?? {}).baseUrl }),
        ...(existingCanonicalProvider?.apiKey !== undefined
          ? {}
          : { apiKey: (asRecord(canonicalProviderConfig) ?? {}).apiKey }),
        ...(typeof existingCanonicalProvider?.api === "string"
          ? {}
          : { api: (asRecord(canonicalProviderConfig) ?? {}).api }),
        ...(typeof existingCanonicalProvider?.authHeader === "boolean"
          ? {}
          : { authHeader: (asRecord(canonicalProviderConfig) ?? {}).authHeader }),
        ...(Array.isArray(existingCanonicalProvider?.models)
          ? {}
          : { models: (asRecord(canonicalProviderConfig) ?? {}).models }),
      }
    : undefined;

  const nextProviders = {
    ...existingProviders,
    ...(canonicalProviderId && mergedCanonicalProvider
      ? { [canonicalProviderId]: mergedCanonicalProvider }
      : {}),
  };

  return {
    ...existing,
    plugins: existingPlugins ?? canonicalPlugins,
    agents: {
      ...canonicalAgents,
      ...existingAgents,
      defaults: {
        ...canonicalDefaults,
        ...existingDefaults,
        workspace:
          typeof existingDefaults.workspace === "string"
            ? existingDefaults.workspace
            : canonicalDefaults.workspace,
        timeoutSeconds:
          typeof existingDefaults.timeoutSeconds === "number"
            ? existingDefaults.timeoutSeconds
            : canonicalDefaults.timeoutSeconds,
        llm: {
          ...canonicalDefaultLlm,
          ...existingDefaultLlm,
          idleTimeoutSeconds:
            typeof existingDefaultLlm.idleTimeoutSeconds === "number"
              ? existingDefaultLlm.idleTimeoutSeconds
              : canonicalDefaultLlm.idleTimeoutSeconds,
        },
        model: {
          ...canonicalDefaultModel,
          ...existingDefaultModel,
          primary:
            typeof existingDefaultModel.primary === "string"
              ? existingDefaultModel.primary
              : canonicalDefaultModel.primary,
        },
        models:
          Object.keys(existingDefaultModels).length > 0
            ? existingDefaultModels
            : canonicalDefaultModels,
      },
    },
    messages: {
      ...canonicalMessages,
      ...existingMessages,
      tts: {
        ...canonicalTts,
        ...existingTts,
        auto: typeof existingTts.auto === "string" ? existingTts.auto : canonicalTts.auto,
      },
    },
    models: {
      ...canonicalModelsRoot,
      ...existingModelsRoot,
      mode:
        typeof existingModelsRoot.mode === "string" ? existingModelsRoot.mode : canonicalModelsRoot.mode,
      providers: nextProviders,
    },
  };
}

function readConfigFile(configPath: string): OpenClawConfig | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid OpenClaw config JSON at ${configPath}: ${message}`);
  }
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`Invalid OpenClaw config at ${configPath}: root must be an object.`);
  }
  return record;
}

export async function ensureCanonicalOpenClawConfig(params: {
  configPath: string;
  workspaceDir: string;
}): Promise<void> {
  const canonical = buildCanonicalConfig({
    workspaceDir: params.workspaceDir,
  });
  const existing = readConfigFile(params.configPath) ?? {};
  const next = mergeCanonicalConfig(existing, canonical);
  await fs.promises.writeFile(params.configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}
