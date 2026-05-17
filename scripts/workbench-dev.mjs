#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const runtimeDir = path.join(repoRoot, ".tmp", "workbench-dev");
const logDir = path.join(runtimeDir, "logs");
const stateDir = path.join(runtimeDir, "state");
const action = process.argv[2] ?? "start";
const packageManagerCommand = process.platform === "win32" ? "corepack.cmd" : "corepack";
const packageManagerPrefix = ["pnpm"];

const services = [
  {
    name: "server",
    command: packageManagerCommand,
    args: [...packageManagerPrefix, "--filter", "@black-bean-sprouts/server", "dev"],
    port: 3000,
    url: "http://localhost:3000/api",
  },
  {
    name: "web",
    command: packageManagerCommand,
    args: [...packageManagerPrefix, "--filter", "@black-bean-sprouts/web", "dev", "--", "--host", "0.0.0.0"],
    port: 5173,
    url: "http://localhost:5173/workbench",
  },
];

function info(message) {
  console.log(`[INFO] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function ensureDirs() {
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
}

function statePath(name) {
  return path.join(stateDir, `${name}.json`);
}

function readState(name) {
  try {
    return JSON.parse(fs.readFileSync(statePath(name), "utf8"));
  } catch {
    return undefined;
  }
}

function writeState(name, state) {
  fs.writeFileSync(statePath(name), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function removeState(name) {
  fs.rmSync(statePath(name), { force: true });
}

function pidExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: repoRoot,
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function buildEnv() {
  const env = {
    ...process.env,
    ...parseEnvFile(path.join(repoRoot, ".env.example")),
    ...parseEnvFile(path.join(repoRoot, ".env")),
  };
  env.PORT ??= "3000";
  env.CLAUDE_CODE_LOCAL_ROOT ??= ".claude-runtime";
  env.CLAUDE_CODE_WORKSPACE_DIR ??= ".";
  return env;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitForPort(port, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function tailFile(filePath, maxLines = 40) {
  try {
    return fs.readFileSync(filePath, "utf8").split(/\r?\n/).slice(-maxLines).join(os.EOL);
  } catch {
    return "";
  }
}

function getManagedState(service) {
  const state = readState(service.name);
  if (!state) {
    return undefined;
  }
  if (!pidExists(Number(state.pid))) {
    removeState(service.name);
    return undefined;
  }
  return state;
}

async function showInfrastructureWarnings() {
  if (!(await isPortOpen(5432))) {
    warn("PostgreSQL is not reachable on localhost:5432. Auth, billing, and saved documents may be degraded.");
  }
  if (!(await isPortOpen(6379))) {
    warn("Redis is not reachable on localhost:6379. Async render queue features may be degraded.");
  }
  if (!(await isPortOpen(9000))) {
    warn("MinIO is not reachable on localhost:9000. Async render file storage may be degraded.");
  }
}

async function startService(service, env) {
  const existing = getManagedState(service);
  if (existing) {
    info(`${service.name} is already running (PID ${existing.pid}, ${existing.url})`);
    return;
  }

  if (await isPortOpen(service.port)) {
    throw new Error(
      `${service.name} cannot start because port ${service.port} is already in use. ` +
        "Stop the existing service first, or run npm run workbench:status to inspect managed services.",
    );
  }

  const stdoutPath = path.join(logDir, `${service.name}.stdout.log`);
  const stderrPath = path.join(logDir, `${service.name}.stderr.log`);
  fs.rmSync(stdoutPath, { force: true });
  fs.rmSync(stderrPath, { force: true });
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  const child = spawn(service.command, service.args, {
    cwd: repoRoot,
    env,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(stdout);
  fs.closeSync(stderr);

  writeState(service.name, {
    pid: child.pid,
    command: [service.command, ...service.args].join(" "),
    port: service.port,
    url: service.url,
    stdoutPath,
    stderrPath,
    startedAt: new Date().toISOString(),
  });

  if (!(await waitForPort(service.port))) {
    await stopService(service, { quiet: true });
    throw new Error(
      [
        `${service.name} failed to listen on port ${service.port}.`,
        "stdout:",
        tailFile(stdoutPath),
        "stderr:",
        tailFile(stderrPath),
      ].join(os.EOL),
    );
  }
  ok(`${service.name} running: ${service.url}`);
}

async function stopProcessTree(pid) {
  if (!pidExists(pid)) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (pidExists(pid)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Already stopped.
      }
    }
  }
}

async function stopService(service, options = {}) {
  const state = readState(service.name);
  if (!state) {
    if (!options.quiet) {
      info(`${service.name} is not running`);
    }
    return;
  }
  const pid = Number(state.pid);
  if (pidExists(pid)) {
    if (!options.quiet) {
      info(`Stopping ${service.name} (PID ${pid})`);
    }
    await stopProcessTree(pid);
  }
  removeState(service.name);
  if (!options.quiet) {
    ok(`${service.name} stopped`);
  }
}

async function start() {
  ensureDirs();
  if (!commandExists(packageManagerCommand)) {
    throw new Error("Missing corepack. Install Node.js >= 20 and run `corepack enable` first.");
  }
  if (!commandExists("node")) {
    throw new Error("Missing node. Install Node.js >= 20 first.");
  }
  await showInfrastructureWarnings();
  const env = buildEnv();
  for (const service of services) {
    await startService(service, env);
  }
  console.log("");
  ok("Workbench is ready");
  console.log("Frontend: http://localhost:5173/workbench");
  console.log("Backend:  http://localhost:3000/api");
  console.log(`Logs:     ${logDir}`);
}

async function stop() {
  ensureDirs();
  for (const service of [...services].reverse()) {
    await stopService(service);
  }
  console.log("");
  ok("Workbench services stopped");
}

async function status() {
  ensureDirs();
  console.log("");
  console.log("Workbench service status");
  console.log("");
  for (const service of services) {
    const state = getManagedState(service);
    if (!state) {
      warn(`${service.name}: stopped`);
      continue;
    }
    ok(`${service.name}: running (PID ${state.pid}, ${state.url})`);
    console.log(`  stdout: ${state.stdoutPath}`);
    console.log(`  stderr: ${state.stderrPath}`);
  }
  console.log("");
}

async function main() {
  switch (action) {
    case "start":
      await start();
      break;
    case "stop":
      await stop();
      break;
    case "restart":
      await stop();
      await start();
      break;
    case "status":
      await status();
      break;
    default:
      throw new Error(`Unknown action: ${action}. Use start, stop, restart, or status.`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
