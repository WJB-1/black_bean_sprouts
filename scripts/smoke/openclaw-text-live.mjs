import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const runtimeDistPath = path.join(
  repoRoot,
  "packages",
  "server",
  "dist",
  "integration",
  "openclaw-runtime.js",
);
const originalProcessExit = process.exit.bind(process);

process.exit = ((code = 0) => {
  const error = new Error(`process.exit(${code})`);
  console.error("PROCESS_EXIT", code, error.stack);
  throw error;
});
process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED_REJECTION", error);
});
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT_EXCEPTION", error);
});

if (!fs.existsSync(runtimeDistPath)) {
  throw new Error(`Missing built runtime at ${runtimeDistPath}`);
}

async function main() {
  console.log("smoke:openclaw-text-live - start");
  const { runOpenClawTextPrompt } = await import(pathToFileURL(runtimeDistPath).href);
  const keepAlive = setInterval(() => {
    console.log("smoke:openclaw-text-live - waiting");
  }, 3000);
  try {
    const result = await runOpenClawTextPrompt({
      message: "Reply with exactly: openclaw-text-live-ok",
      sessionKey: "smoke-openclaw-text-live",
    });
    console.log("smoke:openclaw-text-live - result");
    console.log(result);
  } finally {
    clearInterval(keepAlive);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit = originalProcessExit;
  });
