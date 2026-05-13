import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const runtimeRoot = path.resolve(repoRoot, process.env.CLAUDE_CODE_LOCAL_ROOT || ".claude-runtime");
const homeRoot = path.join(runtimeRoot, "home");
const binName = process.platform === "win32" ? "claude.cmd" : "claude";
const claudeBin =
  process.env.CLAUDE_CODE_BIN ||
  path.join(runtimeRoot, "npm", "node_modules", ".bin", binName);

function buildClaudeApiEnv() {
  const baseUrl =
    process.env.CLAUDE_CODE_BASE_URL ||
    process.env.DEEPSEEK_ANTHROPIC_BASE_URL ||
    process.env.PACKY_API_BASE_URL ||
    process.env.ANTHROPIC_BASE_URL;
  const authToken =
    process.env.CLAUDE_CODE_AUTH_TOKEN ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.PACKY_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN;
  const model = process.env.CLAUDE_CODE_MODEL;

  return {
    ...(baseUrl ? { ANTHROPIC_BASE_URL: baseUrl } : {}),
    ...(authToken ? { ANTHROPIC_AUTH_TOKEN: authToken } : {}),
    ...(model
      ? {
          ANTHROPIC_MODEL: model,
          ANTHROPIC_DEFAULT_OPUS_MODEL: model,
          ANTHROPIC_DEFAULT_SONNET_MODEL: model,
        }
      : {}),
    ...(process.env.CLAUDE_CODE_HAIKU_MODEL
      ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: process.env.CLAUDE_CODE_HAIKU_MODEL }
      : {}),
    ...(process.env.CLAUDE_CODE_SUBAGENT_MODEL
      ? { CLAUDE_CODE_SUBAGENT_MODEL: process.env.CLAUDE_CODE_SUBAGENT_MODEL }
      : {}),
    ...(process.env.CLAUDE_CODE_EFFORT_LEVEL
      ? { CLAUDE_CODE_EFFORT_LEVEL: process.env.CLAUDE_CODE_EFFORT_LEVEL }
      : {}),
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: homeRoot,
        XDG_CONFIG_HOME: path.join(homeRoot, ".config"),
        npm_config_cache: path.join(runtimeRoot, "npm-cache"),
        ...buildClaudeApiEnv(),
        CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
        DISABLE_AUTOUPDATER: "1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main() {
  console.log("smoke:claude-code-local - checking project-local Claude Code runtime...");

  if (!fs.existsSync(claudeBin)) {
    console.error(`FAIL: missing local Claude Code binary at ${claudeBin}`);
    console.error("Run `npm run setup:claude-code` first.");
    process.exit(1);
  }

  const version = await run(claudeBin, ["--version"]);
  if (version.code !== 0) {
    console.error("FAIL: local Claude Code binary did not run.");
    console.error(version.stderr || version.stdout);
    process.exit(1);
  }

  console.log(`PASS: local binary resolved at ${claudeBin}`);
  console.log(`PASS: isolated HOME is ${homeRoot}`);
  console.log(`PASS: claude --version -> ${(version.stdout || version.stderr).trim()}`);

  if (process.env.CLAUDE_CODE_SMOKE_LIVE !== "1") {
    console.log("SKIP: live prompt smoke is disabled; set CLAUDE_CODE_SMOKE_LIVE=1 to run it.");
    return;
  }

  const live = await run("bash", [
    "-lc",
    'exec "$CLAUDE_CODE_BIN" "$@"',
    "claude-code-local",
    "-p",
    "Reply with exactly OK.",
    "--output-format",
    "json",
    "--disallowedTools",
    "Bash",
    "Write",
    "Edit",
    "MultiEdit",
  ], {
    env: {
      ...process.env,
      CLAUDE_CODE_BIN: claudeBin,
      HOME: homeRoot,
      XDG_CONFIG_HOME: path.join(homeRoot, ".config"),
      npm_config_cache: path.join(runtimeRoot, "npm-cache"),
      ...buildClaudeApiEnv(),
      CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
      DISABLE_AUTOUPDATER: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
    },
  });

  if (live.code !== 0) {
    console.error("FAIL: live Claude prompt failed.");
    console.error(live.stderr || live.stdout);
    process.exit(1);
  }

  console.log("PASS: live Claude prompt completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
