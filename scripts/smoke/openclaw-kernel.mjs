import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const gatewayDistPath = path.join(
  repoRoot,
  "packages",
  "server",
  "dist",
  "integration",
  "integration-gateway.js",
);

function isRealMode() {
  return process.env.ENABLE_OPENCLAW_KERNEL === "true";
}

function getNodeVersionParts() {
  return process.versions.node.split(".").map((value) => Number.parseInt(value, 10));
}

function ensureRealModeNodeVersion() {
  const [major = 0, minor = 0] = getNodeVersionParts();
  if (major > 22 || (major === 22 && minor >= 14)) {
    return;
  }

  throw new Error(
    `Real OpenClaw smoke requires Node >= 22.14.0; current runtime is ${process.versions.node}.`,
  );
}

function withRealSmokeEnv() {
  const keys = [
    "OPENCLAW_DISABLE_PLUGIN_DISCOVERY_CACHE",
    "OPENCLAW_DISABLE_PLUGIN_MANIFEST_CACHE",
    "OPENCLAW_PLUGIN_DISCOVERY_CACHE_MS",
    "OPENCLAW_PLUGIN_MANIFEST_CACHE_MS",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.OPENCLAW_DISABLE_PLUGIN_DISCOVERY_CACHE = "1";
  process.env.OPENCLAW_DISABLE_PLUGIN_MANIFEST_CACHE = "1";
  process.env.OPENCLAW_PLUGIN_DISCOVERY_CACHE_MS = "0";
  process.env.OPENCLAW_PLUGIN_MANIFEST_CACHE_MS = "0";

  return () => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function getLifecyclePhases(events) {
  return events
    .filter((event) => event.stream === "lifecycle")
    .map((event) => event.data?.phase)
    .filter((phase) => typeof phase === "string");
}

function getAssistantEvents(events) {
  return events.filter((event) => event.stream === "assistant");
}

function collectErrorMessages(events, runError) {
  const messages = [];

  if (runError instanceof Error && runError.message) {
    messages.push(runError.message);
  } else if (runError) {
    messages.push(String(runError));
  }

  for (const event of events) {
    if (event.stream !== "lifecycle" || event.data?.phase !== "error") {
      continue;
    }
    if (typeof event.data?.error === "string" && event.data.error.trim()) {
      messages.push(event.data.error.trim());
    }
  }

  return messages;
}

function isExpectedAuthBoundary(messages) {
  return messages.some((message) => message.includes('No API key found for provider "openai"'));
}

async function loadGateway() {
  if (!fs.existsSync(gatewayDistPath)) {
    throw new Error(
      `Missing built gateway at ${gatewayDistPath}. Run \`pnpm build\` before this smoke test.`,
    );
  }

  const module = await import(pathToFileURL(gatewayDistPath).href);
  return module.createIntegrationGateway;
}

async function main() {
  const mode = isRealMode() ? "real" : "fake";
  console.log(`smoke:openclaw-kernel - Testing OpenClaw kernel adapter (${mode})...`);
  if (mode === "real") {
    const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(repoRoot, ".openclaw-runtime", "openclaw.json");
    console.log(`smoke:openclaw-kernel - Using canonical config at ${configPath}`);
  }

  let restoreEnv = () => {};
  if (mode === "real") {
    ensureRealModeNodeVersion();
    restoreEnv = withRealSmokeEnv();
  }

  try {
    const createIntegrationGateway = await loadGateway();
    const runtime = createIntegrationGateway().getKernelRuntime();
    const events = [];
    let runError;

    try {
      for await (const event of runtime.run({
        message: "Test message",
        sessionKey: "smoke-openclaw",
      })) {
        events.push(event);
      }
    } catch (error) {
      runError = error;
    }

    if (events.length === 0) {
      console.error("FAIL: no events from kernel");
      if (runError) {
        console.error(runError);
      }
      process.exit(1);
    }

    const phases = getLifecyclePhases(events);
    const assistantEvents = getAssistantEvents(events);
    const errorMessages = collectErrorMessages(events, runError);

    if (assistantEvents.length > 0 && phases.includes("start") && phases.includes("end")) {
      console.log(
        `PASS: OpenClaw kernel adapter works, ${events.length} events (${phases.length} lifecycle, ${assistantEvents.length} assistant, mode=${mode})`,
      );
      return;
    }

    if (mode === "real" && phases.includes("error") && isExpectedAuthBoundary(errorMessages)) {
      console.log(
        `PASS: real OpenClaw kernel reached provider auth boundary (${events.length} events, mode=${mode})`,
      );
      return;
    }

    console.error(
      `FAIL: unexpected event shape (phases=${phases.join(",") || "none"}, assistant=${assistantEvents.length})`,
    );
    if (runError) {
      console.error(runError);
    }
    process.exit(1);
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
