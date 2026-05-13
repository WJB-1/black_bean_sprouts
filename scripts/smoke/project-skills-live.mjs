import assert from "node:assert/strict";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  deleteProjectSkill,
  testProjectSkills,
  upsertProjectSkill,
} from "../../packages/server/dist/services/project-skill-service.js";

function normalizeOptionalString(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function readLine() {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  try {
    return await rl.question("");
  } finally {
    rl.close();
  }
}

async function readApiKey() {
  return (
    normalizeOptionalString(process.env.DEEPSEEK_API_KEY) ??
    normalizeOptionalString(process.env.CLAUDE_CODE_AUTH_TOKEN) ??
    normalizeOptionalString(process.env.ANTHROPIC_AUTH_TOKEN) ??
    normalizeOptionalString(await readLine())
  );
}

async function main() {
  console.log("smoke:project-skills-live - testing different project Skill effects with Claude Code...");
  const apiKey = await readApiKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required via env or stdin.");
  }

  process.env.DEEPSEEK_API_KEY = apiKey;
  process.env.CLAUDE_CODE_BASE_URL = "https://api.deepseek.com/anthropic";
  process.env.CLAUDE_CODE_MODEL = "deepseek-v4-pro[1m]";
  process.env.CLAUDE_CODE_HAIKU_MODEL = "deepseek-v4-flash";
  process.env.CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-v4-flash";
  process.env.CLAUDE_CODE_EFFORT_LEVEL = "max";
  process.env.CLAUDE_CODE_MAX_TURNS = "2";

  const skillNames = ["frontend-json-smoke", "frontend-bullets-smoke"];
  try {
    await upsertProjectSkill({
      name: skillNames[0],
      description: "Smoke skill that forces a JSON-flavored answer.",
      body: [
        "# Instructions",
        "",
        'Return exactly one compact JSON object containing `"mode":"json-skill"` and a short `answer` string.',
      ].join("\n"),
    });
    await upsertProjectSkill({
      name: skillNames[1],
      description: "Smoke skill that forces a bullet-flavored answer.",
      body: [
        "# Instructions",
        "",
        'Return exactly two markdown bullet lines. One line must contain `mode: bullets-skill`.',
      ].join("\n"),
    });

    const results = await testProjectSkills({
      skillNames,
      message: "Describe sprout in a very short answer.",
      live: true,
    });

    assert.equal(results.length, 2);
    const jsonReply = results.find((item) => item.skillName === skillNames[0])?.reply ?? "";
    const bulletReply = results.find((item) => item.skillName === skillNames[1])?.reply ?? "";
    assert.match(jsonReply, /json-skill/u);
    assert.match(bulletReply, /bullets-skill/u);
    assert.notEqual(jsonReply, bulletReply);

    console.log("PASS: live Skill test produced distinct JSON and bullet style outputs");
  } finally {
    await Promise.all(skillNames.map((name) => deleteProjectSkill(name).catch(() => undefined)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
