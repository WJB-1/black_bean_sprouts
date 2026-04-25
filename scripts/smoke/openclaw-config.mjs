import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function assertOk(condition, message, details) {
  if (condition) {
    return;
  }

  console.error(`FAIL: ${message}`);
  if (details !== undefined) {
    console.error(details);
  }
  process.exit(1);
}

function ensureBuiltArtifact(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }
  throw new Error(`Missing built artifact at ${filePath}. Run \`pnpm build\` first.`);
}

async function loadRuntime() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..", "..");
  const configPath = path.join(repoRoot, "packages", "server", "dist", "integration", "openclaw-config.js");
  ensureBuiltArtifact(configPath);
  return import(pathToFileURL(configPath).href);
}

function withEnv(overrides, run) {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return run().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function createConfig(ensureCanonicalOpenClawConfig, overrides) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bbs-openclaw-config-"));
  const configPath = path.join(tempRoot, "openclaw.json");
  const workspaceDir = path.join(tempRoot, "workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });

  try {
    await withEnv(overrides, async () => {
      await ensureCanonicalOpenClawConfig({
        configPath,
        workspaceDir,
      });
    });

    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  console.log("smoke:openclaw-config - Testing OpenClaw provider bootstrap config...");

  const { ensureCanonicalOpenClawConfig } = await loadRuntime();

  const openaiConfig = await createConfig(ensureCanonicalOpenClawConfig, {
    OPENCLAW_BOOTSTRAP_PRIMARY_MODEL: undefined,
    OPENCLAW_BOOTSTRAP_PROVIDER: undefined,
    OPENCLAW_BOOTSTRAP_MODEL_ID: undefined,
    OPENCLAW_PROVIDER: "openai",
    OPENCLAW_MODEL: "openai/gpt-5.4",
  });
  assertOk(
    openaiConfig.agents?.defaults?.model?.primary === "openai/gpt-5.4",
    "openai primary model mismatch",
    openaiConfig,
  );
  assertOk(openaiConfig.models === undefined, "built-in openai provider should not inject custom providers", openaiConfig);

  const codexConfig = await createConfig(ensureCanonicalOpenClawConfig, {
    OPENCLAW_BOOTSTRAP_PRIMARY_MODEL: undefined,
    OPENCLAW_BOOTSTRAP_PROVIDER: undefined,
    OPENCLAW_BOOTSTRAP_MODEL_ID: undefined,
    OPENCLAW_PROVIDER: "openai-codex",
    OPENCLAW_MODEL: "openai-codex/gpt-5.4",
  });
  assertOk(
    codexConfig.agents?.defaults?.model?.primary === "openai-codex/gpt-5.4",
    "openai-codex primary model mismatch",
    codexConfig,
  );
  assertOk(codexConfig.models === undefined, "built-in openai-codex provider should not inject custom providers", codexConfig);

  const siliconflowConfig = await createConfig(ensureCanonicalOpenClawConfig, {
    OPENCLAW_BOOTSTRAP_PRIMARY_MODEL: undefined,
    OPENCLAW_BOOTSTRAP_PROVIDER: undefined,
    OPENCLAW_BOOTSTRAP_MODEL_ID: undefined,
    OPENCLAW_PROVIDER: "siliconflow",
    OPENCLAW_MODEL: "siliconflow/Qwen/Qwen2.5-7B-Instruct",
    SILICONFLOW_MODEL_ID: "Qwen/Qwen2.5-7B-Instruct",
  });
  assertOk(
    siliconflowConfig.models?.providers?.siliconflow?.baseUrl === "https://api.siliconflow.cn/v1",
    "custom siliconflow provider should still be injected",
    siliconflowConfig,
  );

  console.log("PASS: OpenClaw config respects built-in OpenAI providers and keeps custom providers configurable");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
