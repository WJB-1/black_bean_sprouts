import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const runtimeRoot = path.join(repoRoot, ".claude-runtime");
const mcpRoot = path.join(runtimeRoot, "mcp");
const cacheRoot = path.join(runtimeRoot, "npm-cache");
const packageJsonPath = path.join(mcpRoot, "package.json");
const packageJson = {
  private: true,
  name: "black-bean-sprouts-docx-mcp-local",
  version: "0.0.0",
  description: "Project-local DOCX MCP runtime for black_bean_sprouts.",
  dependencies: {
    "@docx-mcp/docx-mcp": "0.5.0",
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
  await fs.promises.mkdir(mcpRoot, { recursive: true });
  await fs.promises.mkdir(cacheRoot, { recursive: true });
  await fs.promises.mkdir(path.join(repoRoot, ".tmp", "docx-mcp-output"), { recursive: true });
  await fs.promises.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  await run("npm", ["install", "--prefix", mcpRoot, "--no-audit", "--no-fund"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      npm_config_cache: cacheRoot,
      npm_config_prefix: mcpRoot,
    },
  });

  const entryPath = path.join(mcpRoot, "node_modules", "@docx-mcp", "docx-mcp", "dist", "index.js");
  await fs.promises.access(entryPath, fs.constants.R_OK);
  console.log(`Local DOCX MCP installed at ${entryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
