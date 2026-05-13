import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const runtimeRoot = path.join(repoRoot, ".claude-runtime");
const npmRoot = path.join(runtimeRoot, "npm");
const homeRoot = path.join(runtimeRoot, "home");
const cacheRoot = path.join(runtimeRoot, "npm-cache");

const packageJsonPath = path.join(npmRoot, "package.json");
const packageJson = {
  private: true,
  name: "black-bean-sprouts-claude-code-local",
  version: "0.0.0",
  description: "Project-local Claude Code runtime for black_bean_sprouts.",
  dependencies: {
    "@anthropic-ai/claude-code": "latest",
  },
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown status"}`));
    });
  });
}

async function main() {
  await fs.promises.mkdir(npmRoot, { recursive: true });
  await fs.promises.mkdir(homeRoot, { recursive: true });
  await fs.promises.mkdir(cacheRoot, { recursive: true });
  await fs.promises.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(
    path.join(homeRoot, ".claude.json"),
    `${JSON.stringify({ hasCompletedOnboarding: true }, null, 2)}\n`,
    "utf8",
  );

  const env = {
    ...process.env,
    HOME: homeRoot,
    XDG_CONFIG_HOME: path.join(homeRoot, ".config"),
    npm_config_cache: cacheRoot,
    npm_config_prefix: npmRoot,
    ...(process.env.CLAUDE_CODE_BASE_URL || process.env.PACKY_API_BASE_URL || process.env.ANTHROPIC_BASE_URL
      ? {
          ANTHROPIC_BASE_URL:
            process.env.CLAUDE_CODE_BASE_URL ??
            process.env.PACKY_API_BASE_URL ??
            process.env.ANTHROPIC_BASE_URL,
        }
      : {}),
    ...(process.env.CLAUDE_CODE_AUTH_TOKEN || process.env.PACKY_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
      ? {
          ANTHROPIC_AUTH_TOKEN:
            process.env.CLAUDE_CODE_AUTH_TOKEN ??
            process.env.PACKY_API_KEY ??
            process.env.ANTHROPIC_AUTH_TOKEN,
        }
      : {}),
    CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
  };

  await run("npm", ["install", "--prefix", npmRoot, "--no-audit", "--no-fund"], {
    cwd: repoRoot,
    env,
  });

  const binName = process.platform === "win32" ? "claude.cmd" : "claude";
  const claudeBin = path.join(npmRoot, "node_modules", ".bin", binName);
  await run(claudeBin, ["--version"], {
    cwd: repoRoot,
    env,
  });

  console.log(`Local Claude Code installed at ${claudeBin}`);
  console.log(`Claude HOME is isolated at ${homeRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
