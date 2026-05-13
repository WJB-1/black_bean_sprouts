import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

function normalizeOptionalString(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readTextContent(value) {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (Array.isArray(value)) {
    return normalizeOptionalString(
      value.map((item) => readTextContent(item)).filter(Boolean).join(""),
    );
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return (
    normalizeOptionalString(value.text) ??
    normalizeOptionalString(value.content) ??
    readTextContent(value.message) ??
    readTextContent(value.data)
  );
}

async function readStdin() {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  try {
    return await rl.question("");
  } finally {
    rl.close();
  }
}

async function readApiKey() {
  const envKey =
    normalizeOptionalString(process.env.DEEPSEEK_API_KEY) ??
    normalizeOptionalString(process.env.CLAUDE_CODE_AUTH_TOKEN) ??
    normalizeOptionalString(process.env.ANTHROPIC_AUTH_TOKEN);
  if (envKey) {
    return envKey;
  }

  const stdinKey = normalizeOptionalString(await readStdin());
  if (stdinKey) {
    return stdinKey;
  }

  throw new Error("DEEPSEEK_API_KEY is required via env or stdin.");
}

async function postJson(url, apiKey, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }

  if (!response.ok) {
    const message =
      typeof json?.error?.message === "string"
        ? json.error.message
        : text.slice(0, 500);
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return json;
}

async function smokeOpenAiCompatible(apiKey) {
  const baseUrl = normalizeOptionalString(process.env.DEEPSEEK_BASE_URL) ?? "https://api.deepseek.com";
  const url = `${baseUrl.replace(/\/+$/u, "")}/chat/completions`;
  const model = normalizeOptionalString(process.env.DEEPSEEK_MODEL) ?? "deepseek-v4-flash";
  const json = await postJson(url, apiKey, {
    model,
    messages: [
      { role: "system", content: "You are a smoke test. Reply with exactly BBS_DEEPSEEK_OK." },
      { role: "user", content: "Return the exact smoke token." },
    ],
    thinking: { type: "disabled" },
    max_tokens: 32,
    temperature: 0,
  });
  const content = normalizeOptionalString(json?.choices?.[0]?.message?.content);
  if (!content?.includes("BBS_DEEPSEEK_OK")) {
    throw new Error(`OpenAI-compatible smoke returned unexpected content: ${content ?? "empty"}`);
  }
  console.log(`PASS: DeepSeek OpenAI-compatible chat completed with model ${json.model ?? model}`);
}

async function smokeAnthropicCompatible(apiKey) {
  const baseUrl =
    normalizeOptionalString(process.env.DEEPSEEK_ANTHROPIC_BASE_URL) ??
    "https://api.deepseek.com/anthropic";
  const url = `${baseUrl.replace(/\/+$/u, "")}/v1/messages`;
  const model = normalizeOptionalString(process.env.DEEPSEEK_ANTHROPIC_MODEL) ?? "deepseek-v4-pro";
  const json = await postJson(
    url,
    apiKey,
    {
      model,
      max_tokens: 128,
      system: "You are a smoke test. Reply with exactly BBS_DEEPSEEK_ANTHROPIC_OK.",
      messages: [{ role: "user", content: "Return the exact smoke token." }],
      temperature: 0,
    },
    {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
  );

  const content =
    readTextContent(json?.content) ??
    readTextContent(json?.completion) ??
    readTextContent(json?.choices?.[0]?.message?.content) ??
    "";
  if (!content.includes("BBS_DEEPSEEK_ANTHROPIC_OK")) {
    throw new Error(`Anthropic-compatible smoke returned unexpected content: ${content || "empty"}`);
  }
  console.log(`PASS: DeepSeek Anthropic-compatible messages completed with model ${json.model ?? model}`);
}

async function main() {
  console.log("smoke:deepseek-api-live - testing DeepSeek API without persisting the API key...");
  const apiKey = await readApiKey();
  await smokeOpenAiCompatible(apiKey);
  await smokeAnthropicCompatible(apiKey);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
