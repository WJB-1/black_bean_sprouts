import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type AdminRuntimeFieldInput =
  | "text"
  | "textarea"
  | "password"
  | "boolean"
  | "select"
  | "number";

export type AdminRuntimeFieldOption = {
  readonly value: string;
  readonly label: string;
};

export type AdminRuntimeFieldDefinition = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly input: AdminRuntimeFieldInput;
  readonly placeholder?: string;
  readonly options?: readonly AdminRuntimeFieldOption[];
  readonly persistMode?: "plain" | "json" | "escaped-newlines";
  readonly secret?: boolean;
};

export type AdminRuntimeSectionDefinition = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly restartNote: string;
  readonly fields: readonly AdminRuntimeFieldDefinition[];
};

export type AdminRuntimeFieldSnapshot = AdminRuntimeFieldDefinition & {
  readonly persistedValue: string;
  readonly activeValue: string;
  readonly configured: boolean;
  readonly activeConfigured: boolean;
  readonly pendingRestart: boolean;
};

export type AdminRuntimeSectionSnapshot = Omit<AdminRuntimeSectionDefinition, "fields"> & {
  readonly fields: readonly AdminRuntimeFieldSnapshot[];
};

export type AdminRuntimeSnapshot = {
  readonly envFilePath: string;
  readonly exampleFilePath: string;
  readonly pendingRestartCount: number;
  readonly overview: {
    readonly workbenchUrl: string;
    readonly adminUrl: string;
    readonly apiBaseUrl: string;
    readonly loginHint: string;
    readonly promptProvider: string;
    readonly llmSelection: string;
    readonly billingProviders: readonly string[];
    readonly billingDefaultProvider: string;
    readonly infrastructure: {
      readonly databaseConfigured: boolean;
      readonly redisConfigured: boolean;
      readonly minioConfigured: boolean;
    };
    readonly paymentReadiness: {
      readonly developer: boolean;
      readonly stripe: boolean;
      readonly alipay: boolean;
      readonly wechatpay: boolean;
    };
  };
  readonly sections: readonly AdminRuntimeSectionSnapshot[];
};

const WORKBENCH_PROVIDER_OPTIONS = Object.freeze([
  { value: "claude-code", label: "Claude Code Local" },
  { value: "siliconflow-direct", label: "SiliconFlow Direct" },
  { value: "openclaw", label: "OpenClaw Router (legacy)" },
]);

const AI_KERNEL_PROVIDER_OPTIONS = Object.freeze([
  { value: "claude-code", label: "Claude Code Local" },
  { value: "fake", label: "Fake Kernel" },
  { value: "openclaw", label: "OpenClaw Router (legacy)" },
]);

const OPENCLAW_PROVIDER_OPTIONS = Object.freeze([
  { value: "siliconflow", label: "SiliconFlow" },
  { value: "openai", label: "OpenAI Platform API" },
  { value: "openai-codex", label: "OpenAI Membership / Codex" },
]);

const BILLING_DEFAULT_PROVIDER_OPTIONS = Object.freeze([
  { value: "developer", label: "developer" },
  { value: "stripe", label: "stripe" },
  { value: "alipay", label: "alipay" },
  { value: "wechatpay", label: "wechatpay" },
]);

const BILLING_DEVELOPER_MODE_OPTIONS = Object.freeze([
  { value: "manual", label: "manual" },
  { value: "instant", label: "instant" },
]);

const ADMIN_RUNTIME_SECTIONS: readonly AdminRuntimeSectionDefinition[] = Object.freeze([
  {
    key: "app",
    label: "App And Auth",
    description: "Base URLs and the admin authentication secret.",
    restartNote: "Restart the workbench after changing port or JWT settings.",
    fields: [
      {
        key: "PORT",
        label: "Server Port",
        description: "HTTP port for the backend and static frontend.",
        input: "number",
        placeholder: "3000",
      },
      {
        key: "APP_BASE_URL",
        label: "App Base URL",
        description: "Public base URL used for redirects and payment callbacks.",
        input: "text",
        placeholder: "http://localhost:3000",
      },
      {
        key: "JWT_SECRET",
        label: "JWT Secret",
        description: "Secret used to sign admin and user tokens.",
        input: "password",
        placeholder: "change-me-in-production",
        secret: true,
      },
    ],
  },
  {
    key: "infra",
    label: "Infrastructure",
    description: "Database, Redis, and MinIO connection settings.",
    restartNote: "These values are read during startup. Save, then restart the workbench.",
    fields: [
      {
        key: "DATABASE_URL",
        label: "Database URL",
        description: "Prisma connection string for PostgreSQL.",
        input: "text",
        placeholder: "postgresql://postgres:postgres@localhost:5432/black_bean_sprouts?schema=public",
      },
      {
        key: "REDIS_HOST",
        label: "Redis Host",
        description: "Redis hostname for async render queue workers.",
        input: "text",
        placeholder: "localhost",
      },
      {
        key: "REDIS_PORT",
        label: "Redis Port",
        description: "Redis TCP port.",
        input: "number",
        placeholder: "6379",
      },
      {
        key: "MINIO_ENDPOINT",
        label: "MinIO Endpoint",
        description: "MinIO or S3-compatible object storage host.",
        input: "text",
        placeholder: "localhost",
      },
      {
        key: "MINIO_PORT",
        label: "MinIO Port",
        description: "MinIO object storage port.",
        input: "number",
        placeholder: "9000",
      },
      {
        key: "MINIO_ACCESS_KEY",
        label: "MinIO Access Key",
        description: "Object storage access key.",
        input: "password",
        placeholder: "minioadmin",
        secret: true,
      },
      {
        key: "MINIO_SECRET_KEY",
        label: "MinIO Secret Key",
        description: "Object storage secret key.",
        input: "password",
        placeholder: "minioadmin",
        secret: true,
      },
      {
        key: "MINIO_BUCKET",
        label: "MinIO Bucket",
        description: "Bucket name for generated files.",
        input: "text",
        placeholder: "black-bean-sprouts",
      },
      {
        key: "MINIO_USE_SSL",
        label: "MinIO Use SSL",
        description: "Enable HTTPS for object storage access.",
        input: "boolean",
      },
    ],
  },
  {
    key: "ai",
    label: "AI Runtime",
    description: "Prompt routing, Claude Code runtime paths, and legacy provider settings.",
    restartNote: "Most values take effect after restarting the workbench server.",
    fields: [
      {
        key: "AI_KERNEL_PROVIDER",
        label: "Agent Kernel Provider",
        description: "Select the backend agent kernel. Claude Code Local is the primary path.",
        input: "select",
        options: AI_KERNEL_PROVIDER_OPTIONS,
      },
      {
        key: "ENABLE_CLAUDE_CODE_KERNEL",
        label: "Enable Claude Code Kernel",
        description: "Legacy boolean switch for selecting the local Claude Code kernel.",
        input: "boolean",
      },
      {
        key: "ENABLE_OPENCLAW_KERNEL",
        label: "Enable OpenClaw Kernel",
        description: "Legacy switch for the old OpenClaw integration.",
        input: "boolean",
      },
      {
        key: "WORKBENCH_PROMPT_PROVIDER",
        label: "Workbench Prompt Provider",
        description: "Select whether workbench generation calls local Claude Code or a legacy provider.",
        input: "select",
        options: WORKBENCH_PROVIDER_OPTIONS,
      },
      {
        key: "AGENT_DOCUMENT_AUTONOMY_PROVIDER",
        label: "Document Autonomy Provider",
        description: "Provider for document repair prompts. Use claude-code for the local Claude path.",
        input: "select",
        options: WORKBENCH_PROVIDER_OPTIONS,
      },
      {
        key: "CLAUDE_CODE_LOCAL_ROOT",
        label: "Claude Code Local Root",
        description: "Project-local directory for the Claude npm install, HOME, cache, and sessions.",
        input: "text",
        placeholder: ".claude-runtime",
      },
      {
        key: "CLAUDE_CODE_WORKSPACE_DIR",
        label: "Claude Code Workspace Dir",
        description: "Default working directory for Claude Code runs.",
        input: "text",
        placeholder: ".",
      },
      {
        key: "CLAUDE_CODE_TIMEOUT_MS",
        label: "Claude Code Timeout Ms",
        description: "Timeout for Claude Code subprocess runs.",
        input: "number",
        placeholder: "120000",
      },
      {
        key: "CLAUDE_CODE_MAX_TURNS",
        label: "Claude Code Max Turns",
        description: "Optional max-turns value passed to Claude Code.",
        input: "number",
        placeholder: "8",
      },
      {
        key: "CLAUDE_CODE_MODEL",
        label: "Claude Code Model",
        description: "Optional Claude model override for local Claude Code.",
        input: "text",
        placeholder: "deepseek-v4-pro[1m]",
      },
      {
        key: "CLAUDE_CODE_HAIKU_MODEL",
        label: "Claude Code Haiku Model",
        description: "Optional lightweight/default Haiku model override for Claude Code.",
        input: "text",
        placeholder: "deepseek-v4-flash",
      },
      {
        key: "CLAUDE_CODE_SUBAGENT_MODEL",
        label: "Claude Code Subagent Model",
        description: "Optional model used by Claude Code subagents.",
        input: "text",
        placeholder: "deepseek-v4-flash",
      },
      {
        key: "CLAUDE_CODE_EFFORT_LEVEL",
        label: "Claude Code Effort Level",
        description: "Optional Claude Code effort level, for example max when using DeepSeek.",
        input: "text",
        placeholder: "max",
      },
      {
        key: "CLAUDE_CODE_PERMISSION_MODE",
        label: "Claude Code Permission Mode",
        description: "Optional Claude Code permission mode. Leave blank for CLI defaults.",
        input: "text",
        placeholder: "",
      },
      {
        key: "CLAUDE_CODE_BASE_URL",
        label: "Claude Code Base URL",
        description: "Anthropic-compatible endpoint for Claude Code, for example DeepSeek or PackyAPI.",
        input: "text",
        placeholder: "https://api.deepseek.com/anthropic",
      },
      {
        key: "CLAUDE_CODE_AUTH_TOKEN",
        label: "Claude Code Auth Token",
        description: "Claude Code API token. For PackyAPI, use a CC group token.",
        input: "password",
        placeholder: "pk-...",
        secret: true,
      },
      {
        key: "DEEPSEEK_ANTHROPIC_BASE_URL",
        label: "DeepSeek Anthropic Base URL",
        description: "Compatibility alias for Claude Code Base URL when using DeepSeek.",
        input: "text",
        placeholder: "https://api.deepseek.com/anthropic",
      },
      {
        key: "DEEPSEEK_API_KEY",
        label: "DeepSeek API Key",
        description: "Compatibility alias for Claude Code Auth Token and DeepSeek smoke tests.",
        input: "password",
        placeholder: "sk-...",
        secret: true,
      },
      {
        key: "PACKY_API_BASE_URL",
        label: "PackyAPI Base URL",
        description: "Compatibility alias for Claude Code Base URL.",
        input: "text",
        placeholder: "https://www.packyapi.com",
      },
      {
        key: "PACKY_API_KEY",
        label: "PackyAPI Key",
        description: "Compatibility alias for Claude Code Auth Token.",
        input: "password",
        placeholder: "pk-...",
        secret: true,
      },
      {
        key: "OPENCLAW_PROVIDER",
        label: "OpenClaw Provider",
        description: "Provider id used by the OpenClaw bootstrap config.",
        input: "select",
        options: OPENCLAW_PROVIDER_OPTIONS,
      },
      {
        key: "OPENCLAW_MODEL",
        label: "OpenClaw Model",
        description: "Model id used by OpenClaw, for example openai/gpt-5.4 or siliconflow/Qwen/Qwen2.5-7B-Instruct.",
        input: "text",
        placeholder: "openai/gpt-5.4",
      },
      {
        key: "OPENCLAW_PROJECT_PATH",
        label: "OpenClaw Project Path",
        description: "Filesystem path to the OpenClaw repo root.",
        input: "text",
        placeholder: "../reference_projects/openclaw",
      },
      {
        key: "OPENCLAW_STATE_DIR",
        label: "OpenClaw State Dir",
        description: "State directory for the embedded OpenClaw runtime.",
        input: "text",
        placeholder: ".openclaw-runtime",
      },
      {
        key: "OPENCLAW_CONFIG_PATH",
        label: "OpenClaw Config Path",
        description: "Path to the generated OpenClaw bootstrap config.",
        input: "text",
        placeholder: ".openclaw-runtime/openclaw.json",
      },
      {
        key: "OPENCLAW_WORKSPACE_DIR",
        label: "OpenClaw Workspace Dir",
        description: "Workspace directory OpenClaw can read and write.",
        input: "text",
        placeholder: ".",
      },
      {
        key: "OPENCLAW_TIMEOUT_MS",
        label: "OpenClaw Timeout Ms",
        description: "Timeout for OpenClaw runtime commands.",
        input: "number",
        placeholder: "120000",
      },
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API Key",
        description: "Used when OpenClaw provider is openai.",
        input: "password",
        placeholder: "sk-...",
        secret: true,
      },
      {
        key: "SILICONFLOW_API_KEY",
        label: "SiliconFlow API Key",
        description: "Used for SiliconFlow direct mode or OpenClaw SiliconFlow provider.",
        input: "password",
        placeholder: "sk-...",
        secret: true,
      },
      {
        key: "SILICONFLOW_BASE_URL",
        label: "SiliconFlow Base URL",
        description: "Base URL for the SiliconFlow OpenAI-compatible API.",
        input: "text",
        placeholder: "https://api.siliconflow.cn/v1",
      },
      {
        key: "SILICONFLOW_MODEL",
        label: "SiliconFlow Model",
        description: "Direct-call model name for SiliconFlow prompt generation.",
        input: "text",
        placeholder: "Qwen/Qwen2.5-7B-Instruct",
      },
      {
        key: "SILICONFLOW_MODEL_ID",
        label: "SiliconFlow Model Id",
        description: "Compatibility model id used for OpenClaw bootstrap.",
        input: "text",
        placeholder: "Qwen/Qwen2.5-7B-Instruct",
      },
    ],
  },
  {
    key: "billing-core",
    label: "Billing Core",
    description: "Global payment behavior, provider list, and plan catalog.",
    restartNote: "Billing config changes are safest after restart; provider credentials also need matching frontend URLs.",
    fields: [
      {
        key: "BILLING_PROVIDERS",
        label: "Enabled Billing Providers",
        description: "Comma-separated list such as developer,stripe,alipay,wechatpay.",
        input: "text",
        placeholder: "developer",
      },
      {
        key: "BILLING_DEFAULT_PROVIDER",
        label: "Default Billing Provider",
        description: "Provider used when the frontend does not specify one.",
        input: "select",
        options: BILLING_DEFAULT_PROVIDER_OPTIONS,
      },
      {
        key: "BILLING_DEVELOPER_MODE",
        label: "Developer Billing Mode",
        description: "manual keeps the fake order pending until confirm; instant marks it paid immediately.",
        input: "select",
        options: BILLING_DEVELOPER_MODE_OPTIONS,
      },
      {
        key: "BILLING_SUCCESS_URL",
        label: "Billing Success URL",
        description: "Frontend route users return to after success. You can keep {CHECKOUT_SESSION_ID}.",
        input: "text",
        placeholder: "http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
      },
      {
        key: "BILLING_CANCEL_URL",
        label: "Billing Cancel URL",
        description: "Frontend route users return to when payment is cancelled.",
        input: "text",
        placeholder: "http://localhost:3000/billing/cancel",
      },
      {
        key: "BILLING_PLANS_JSON",
        label: "Billing Plans JSON",
        description: "Optional JSON array that overrides the built-in plan catalog.",
        input: "textarea",
        persistMode: "json",
        placeholder: "[{\"id\":\"pro-month\",\"name\":\"Pro Monthly\",\"amountCents\":1999,\"currency\":\"cny\"}]",
      },
    ],
  },
  {
    key: "stripe",
    label: "Stripe",
    description: "Stripe checkout configuration.",
    restartNote: "Save the keys, restart, then use the route-level billing smoke to validate.",
    fields: [
      {
        key: "STRIPE_SECRET_KEY",
        label: "Stripe Secret Key",
        description: "Server-side Stripe API key.",
        input: "password",
        placeholder: "sk_live_...",
        secret: true,
      },
      {
        key: "STRIPE_PUBLISHABLE_KEY",
        label: "Stripe Publishable Key",
        description: "Frontend publishable key for future client integrations.",
        input: "text",
        placeholder: "pk_live_...",
      },
    ],
  },
  {
    key: "alipay",
    label: "Alipay",
    description: "Alipay app ids, keys, and callback URLs.",
    restartNote: "Use escaped PEM text. Save, restart, then validate notify handling.",
    fields: [
      {
        key: "ALIPAY_APP_ID",
        label: "Alipay App Id",
        description: "Merchant app id from Alipay Open Platform.",
        input: "text",
      },
      {
        key: "ALIPAY_GATEWAY_URL",
        label: "Alipay Gateway URL",
        description: "Gateway endpoint. Sandbox or production.",
        input: "text",
        placeholder: "https://openapi.alipay.com/gateway.do",
      },
      {
        key: "ALIPAY_APP_PRIVATE_KEY",
        label: "Alipay App Private Key",
        description: "Paste the PEM key. Newlines are stored as \\n automatically.",
        input: "textarea",
        persistMode: "escaped-newlines",
        secret: true,
      },
      {
        key: "ALIPAY_ALIPAY_PUBLIC_KEY",
        label: "Alipay Platform Public Key",
        description: "Paste the Alipay platform public key PEM.",
        input: "textarea",
        persistMode: "escaped-newlines",
      },
      {
        key: "ALIPAY_RETURN_URL",
        label: "Alipay Return URL",
        description: "Browser redirect after payment success.",
        input: "text",
      },
      {
        key: "ALIPAY_NOTIFY_URL",
        label: "Alipay Notify URL",
        description: "Server-to-server callback endpoint. Leave blank to use the generated default.",
        input: "text",
      },
    ],
  },
  {
    key: "wechatpay",
    label: "WeChat Pay",
    description: "WeChat Pay v3 merchant settings.",
    restartNote: "Use escaped PEM text where required. Save, restart, then validate notify handling.",
    fields: [
      {
        key: "WECHAT_PAY_APP_ID",
        label: "WeChat Pay App Id",
        description: "WeChat application id used for the merchant account.",
        input: "text",
      },
      {
        key: "WECHAT_PAY_MCH_ID",
        label: "WeChat Merchant Id",
        description: "Merchant id (mchid).",
        input: "text",
      },
      {
        key: "WECHAT_PAY_MCH_SERIAL_NO",
        label: "Merchant Certificate Serial",
        description: "Serial number of the merchant API certificate.",
        input: "text",
      },
      {
        key: "WECHAT_PAY_PRIVATE_KEY",
        label: "Merchant Private Key",
        description: "Merchant private key PEM. Newlines are stored as \\n automatically.",
        input: "textarea",
        persistMode: "escaped-newlines",
        secret: true,
      },
      {
        key: "WECHAT_PAY_API_V3_KEY",
        label: "API V3 Key",
        description: "Must be 32 bytes for notification decryption.",
        input: "password",
        secret: true,
      },
      {
        key: "WECHAT_PAY_PLATFORM_CERT",
        label: "Platform Certificate",
        description: "WeChat platform certificate PEM.",
        input: "textarea",
        persistMode: "escaped-newlines",
      },
      {
        key: "WECHAT_PAY_PLATFORM_CERT_SERIAL",
        label: "Platform Certificate Serial",
        description: "Optional certificate serial for response verification.",
        input: "text",
      },
      {
        key: "WECHAT_PAY_NOTIFY_URL",
        label: "WeChat Notify URL",
        description: "Server callback endpoint. Leave blank to use the generated default.",
        input: "text",
      },
    ],
  },
]);

const FIELD_BY_KEY = new Map(
  ADMIN_RUNTIME_SECTIONS.flatMap((section) =>
    section.fields.map((field) => [field.key, field] as const),
  ),
);

export async function getAdminRuntimeSnapshot(): Promise<AdminRuntimeSnapshot> {
  const envFilePath = resolve(process.cwd(), ".env");
  const exampleFilePath = resolve(process.cwd(), ".env.example");
  const exampleValues = await readDotEnvFile(exampleFilePath);
  const persistedOverrides = await readDotEnvFile(envFilePath);
  const persistedValues = {
    ...exampleValues,
    ...persistedOverrides,
  };

  const sections = ADMIN_RUNTIME_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      const persistedValue = normalizeDisplayValue(field, persistedValues[field.key]);
      const activeValue = normalizeDisplayValue(field, process.env[field.key]);
      return {
        ...field,
        persistedValue,
        activeValue,
        configured: persistedValue.length > 0,
        activeConfigured: activeValue.length > 0,
        pendingRestart: persistedValue !== activeValue,
      };
    }),
  }));

  const pendingRestartCount = sections.reduce(
    (count, section) => count + section.fields.filter((field) => field.pendingRestart).length,
    0,
  );

  const appBaseUrl = resolveOverviewBaseUrl(persistedValues.APP_BASE_URL, process.env.APP_BASE_URL);
  const billingProviders = splitCommaList(
    persistedValues.BILLING_PROVIDERS ?? process.env.BILLING_PROVIDERS ?? "developer",
  );

  return {
    envFilePath,
    exampleFilePath,
    pendingRestartCount,
    overview: {
      workbenchUrl: `${appBaseUrl}/workbench`,
      adminUrl: `${appBaseUrl}/admin`,
      apiBaseUrl: `${appBaseUrl}/api`,
      loginHint: "Login with an email containing 'admin' to get an ADMIN token.",
      promptProvider:
        normalizeNonEmpty(persistedValues.WORKBENCH_PROMPT_PROVIDER) ??
        normalizeNonEmpty(process.env.WORKBENCH_PROMPT_PROVIDER) ??
        "claude-code",
      llmSelection:
        normalizeNonEmpty(persistedValues.CLAUDE_CODE_MODEL) ??
        normalizeNonEmpty(process.env.CLAUDE_CODE_MODEL) ??
        normalizeNonEmpty(persistedValues.OPENCLAW_MODEL) ??
        normalizeNonEmpty(process.env.OPENCLAW_MODEL) ??
        normalizeNonEmpty(persistedValues.SILICONFLOW_MODEL) ??
        normalizeNonEmpty(process.env.SILICONFLOW_MODEL) ??
        "not configured",
      billingProviders,
      billingDefaultProvider:
        normalizeNonEmpty(persistedValues.BILLING_DEFAULT_PROVIDER) ??
        normalizeNonEmpty(process.env.BILLING_DEFAULT_PROVIDER) ??
        "developer",
      infrastructure: {
        databaseConfigured: Boolean(normalizeNonEmpty(persistedValues.DATABASE_URL)),
        redisConfigured: Boolean(
          normalizeNonEmpty(persistedValues.REDIS_HOST) && normalizeNonEmpty(persistedValues.REDIS_PORT),
        ),
        minioConfigured: Boolean(
          normalizeNonEmpty(persistedValues.MINIO_ENDPOINT) &&
            normalizeNonEmpty(persistedValues.MINIO_PORT) &&
            normalizeNonEmpty(persistedValues.MINIO_BUCKET),
        ),
      },
      paymentReadiness: {
        developer: true,
        stripe: Boolean(normalizeNonEmpty(persistedValues.STRIPE_SECRET_KEY)),
        alipay: Boolean(
          normalizeNonEmpty(persistedValues.ALIPAY_APP_ID) &&
            normalizeNonEmpty(persistedValues.ALIPAY_APP_PRIVATE_KEY) &&
            normalizeNonEmpty(persistedValues.ALIPAY_ALIPAY_PUBLIC_KEY),
        ),
        wechatpay: Boolean(
          normalizeNonEmpty(persistedValues.WECHAT_PAY_APP_ID) &&
            normalizeNonEmpty(persistedValues.WECHAT_PAY_MCH_ID) &&
            normalizeNonEmpty(persistedValues.WECHAT_PAY_MCH_SERIAL_NO) &&
            normalizeNonEmpty(persistedValues.WECHAT_PAY_PRIVATE_KEY) &&
            normalizeNonEmpty(persistedValues.WECHAT_PAY_API_V3_KEY),
        ),
      },
    },
    sections,
  };
}

export async function updateAdminRuntimeSettings(
  input: Record<string, unknown>,
): Promise<AdminRuntimeSnapshot> {
  const envFilePath = resolve(process.cwd(), ".env");
  const exampleFilePath = resolve(process.cwd(), ".env.example");
  const exampleValues = await readDotEnvFile(exampleFilePath);
  const currentValues = {
    ...exampleValues,
    ...(await readDotEnvFile(envFilePath)),
  };

  const nextValues = { ...currentValues };
  for (const [key, rawValue] of Object.entries(input)) {
    const field = FIELD_BY_KEY.get(key);
    if (!field) {
      continue;
    }
    nextValues[key] = normalizePersistedValue(field, rawValue);
  }

  const billingDefaultProvider = nextValues.BILLING_DEFAULT_PROVIDER;
  if (billingDefaultProvider && normalizeNonEmpty(billingDefaultProvider)) {
    nextValues.BILLING_PROVIDER = billingDefaultProvider;
  }
  const siliconflowModel = nextValues.SILICONFLOW_MODEL;
  if (siliconflowModel && normalizeNonEmpty(siliconflowModel)) {
    nextValues.SILICONFLOW_MODEL_ID = siliconflowModel;
  }

  const knownKeys = new Set(FIELD_BY_KEY.keys());
  knownKeys.add("BILLING_PROVIDER");
  const customEntries = Object.entries(nextValues).filter(([key]) => !knownKeys.has(key));

  const lines: string[] = [
    "# Generated by the admin console.",
    "# Save in the UI, then restart start-workbench.ps1 to guarantee every setting is reloaded.",
    "",
  ];

  for (const section of ADMIN_RUNTIME_SECTIONS) {
    lines.push(`# ${section.label}`);
    for (const field of section.fields) {
      const value = nextValues[field.key] ?? "";
      lines.push(`${field.key}=${value}`);
    }
    lines.push("");
  }

  if (normalizeNonEmpty(nextValues.BILLING_PROVIDER)) {
    lines.push("# Legacy compatibility");
    lines.push(`BILLING_PROVIDER=${nextValues.BILLING_PROVIDER}`);
    lines.push("");
  }

  if (customEntries.length > 0) {
    lines.push("# Custom / unmanaged values");
    for (const [key, value] of customEntries.sort(([left], [right]) => left.localeCompare(right))) {
      lines.push(`${key}=${value}`);
    }
    lines.push("");
  }

  await writeFile(envFilePath, lines.join("\n"), "utf8");
  return getAdminRuntimeSnapshot();
}

function normalizeDisplayValue(
  field: AdminRuntimeFieldDefinition,
  rawValue: string | undefined,
): string {
  const value = normalizeNonEmpty(rawValue) ?? "";
  if (value.length === 0) {
    return "";
  }
  if (field.persistMode === "escaped-newlines") {
    return value.replace(/\\n/g, "\n");
  }
  if (field.persistMode === "json") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return value;
}

function normalizePersistedValue(
  field: AdminRuntimeFieldDefinition,
  rawValue: unknown,
): string {
  if (field.input === "boolean") {
    return rawValue === true || rawValue === "true" ? "true" : "false";
  }

  if (rawValue === null || rawValue === undefined) {
    return "";
  }

  const stringValue = String(rawValue).trim();
  if (stringValue.length === 0) {
    return "";
  }

  if (field.input === "number") {
    const numericValue = Number(stringValue);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`${field.label} must be a valid number.`);
    }
    return `${numericValue}`;
  }

  if (field.persistMode === "json") {
    try {
      return JSON.stringify(JSON.parse(stringValue));
    } catch (error) {
      throw new Error(
        `${field.label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (field.persistMode === "escaped-newlines") {
    return stringValue.replace(/\r\n/g, "\n").replace(/\n/g, "\\n");
  }

  return stringValue;
}

async function readDotEnvFile(path: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(path, "utf8");
    return parseDotEnv(content);
  } catch {
    return {};
  }
}

function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(rawLine);
    if (!match) {
      continue;
    }

    const key = match[1];
    if (!key) {
      continue;
    }

    const rawValue = match[2] ?? "";
    let value = rawValue.trim();
    if (value.length >= 2) {
      const startsWithDouble = value.startsWith("\"");
      const endsWithDouble = value.endsWith("\"");
      const startsWithSingle = value.startsWith("'");
      const endsWithSingle = value.endsWith("'");
      if ((startsWithDouble && endsWithDouble) || (startsWithSingle && endsWithSingle)) {
        value = value.slice(1, -1);
      }
    }
    result[key] = value;
  }
  return result;
}

function splitCommaList(rawValue: string): readonly string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeNonEmpty(rawValue: string | undefined): string | undefined {
  const trimmed = rawValue?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveOverviewBaseUrl(
  persistedBaseUrl: string | undefined,
  activeBaseUrl: string | undefined,
): string {
  return (
    normalizeNonEmpty(activeBaseUrl) ??
    normalizeNonEmpty(persistedBaseUrl) ??
    "http://localhost:3000"
  );
}
