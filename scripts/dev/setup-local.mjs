import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const tmpRoot = path.join(repoRoot, ".tmp");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
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
  await fs.promises.mkdir(tmpRoot, { recursive: true });
  const env = {
    ...process.env,
    CI: process.env.CI ?? "true",
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    PRISMA_ENGINES_CACHE_DIR: path.join(tmpRoot, "prisma-engines"),
    XDG_CACHE_HOME: path.join(tmpRoot, "cache"),
  };

  await run("corepack", ["pnpm", "install", "--frozen-lockfile"], { env });
  await run("node", ["scripts/dev/install-claude-code-local.mjs"], { env });
  await run("node", ["scripts/dev/install-docx-mcp-local.mjs"], { env });
  await run("node", ["scripts/ensure-prisma-client.mjs"], { env });

  console.log("Local setup complete.");
  console.log("Configure .env with DEEPSEEK_API_KEY or CLAUDE_CODE_AUTH_TOKEN before live AI use.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
