import { createHmac } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const envExamplePath = resolve(repoRoot, ".env.example");
const envPath = resolve(repoRoot, ".env");
const serverEntryPath = resolve(repoRoot, "packages", "server", "dist", "index.js");
const port = 3101;
const jwtSecret = "admin-runtime-write-smoke-secret";

async function main() {
  console.log("smoke:admin-runtime-write - Testing admin runtime settings write path...");

  const originalEnvText = await readFileOrNull(envPath);
  const baseEnv = {
    ...parseDotEnv(await readFile(envExamplePath, "utf8")),
    ...parseDotEnv(originalEnvText ?? ""),
  };

  const child = spawn(
    process.execPath,
    [serverEntryPath],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...baseEnv,
        PORT: `${port}`,
        JWT_SECRET: jwtSecret,
        DATABASE_URL:
          baseEnv.DATABASE_URL ??
          "postgresql://postgres:postgres@127.0.0.1:5432/black_bean_sprouts?schema=public",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/admin`);

    const token = createJwt(jwtSecret, {
      sub: "admin-runtime-write-smoke",
      email: "admin-smoke@test.local",
      role: "ADMIN",
    });

    const initialSnapshot = await requestJson(`http://127.0.0.1:${port}/api/admin/runtime-settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const timeoutField = findField(initialSnapshot, "OPENCLAW_TIMEOUT_MS");
    assert(timeoutField, "OPENCLAW_TIMEOUT_MS field not found in runtime settings snapshot");

    const originalValue = timeoutField.persistedValue || "120000";
    const mutatedValue = originalValue === "120000" ? "120321" : "120000";

    const updatedSnapshot = await requestJson(`http://127.0.0.1:${port}/api/admin/runtime-settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: {
          OPENCLAW_TIMEOUT_MS: mutatedValue,
        },
      }),
    });

    const updatedField = findField(updatedSnapshot, "OPENCLAW_TIMEOUT_MS");
    assert(updatedField?.persistedValue === mutatedValue, "Runtime settings API did not return the updated persisted value");

    const writtenEnvText = await readFile(envPath, "utf8");
    assert(
      new RegExp(`^OPENCLAW_TIMEOUT_MS=${escapeRegExp(mutatedValue)}$`, "m").test(writtenEnvText),
      "The .env file was not updated by the admin runtime settings API",
    );

    console.log(`  - Original OPENCLAW_TIMEOUT_MS: ${originalValue}`);
    console.log(`  - Updated OPENCLAW_TIMEOUT_MS:  ${mutatedValue}`);
    console.log("  - .env write verified: OK");
  } finally {
    if (originalEnvText === null) {
      await unlink(envPath).catch(() => {});
    } else {
      await writeFile(envPath, originalEnvText, "utf8");
    }

    child.kill("SIGTERM");
    await waitForExit(child);
  }

  console.log("PASS: admin runtime settings can modify backend configuration and write .env");
}

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(rawLine);
    if (!match || !match[1]) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";
    value = value.trim();
    if (value.length >= 2) {
      const quoted =
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"));
      if (quoted) {
        value = value.slice(1, -1);
      }
    }
    result[key] = value;
  }
  return result;
}

function createJwt(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + 60 * 10,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return JSON.parse(text);
}

function findField(snapshot, key) {
  for (const section of snapshot.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.key === key) {
        return field;
      }
    }
  }
  return null;
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

async function waitForExit(child) {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise((resolveExit) => {
    child.once("exit", () => resolveExit());
    setTimeout(() => resolveExit(), 5_000);
  });
}

async function readFileOrNull(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
