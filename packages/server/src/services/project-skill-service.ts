import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runClaudeCodeTextPrompt } from "../integration/claude-code-runtime.js";

export type ProjectSkillSummary = {
  readonly name: string;
  readonly description: string;
  readonly relativePath: string;
  readonly hash: string;
  readonly updatedAt: string;
};

export type ProjectSkillDetail = ProjectSkillSummary & {
  readonly content: string;
  readonly body: string;
};

export type ProjectSkillTestResult = {
  readonly skillName: string;
  readonly mode: "dry-run" | "live";
  readonly promptPreview: string;
  readonly reply?: string;
};

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function getRepoRoot(): string {
  return process.cwd();
}

function getSkillsRoot(): string {
  return path.join(getRepoRoot(), ".claude", "skills");
}

function assertValidSkillName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!SKILL_NAME_RE.test(normalized)) {
    throw new Error("Skill name must match /^[a-z0-9][a-z0-9-]{0,63}$/.");
  }
  return normalized;
}

function getSkillPath(name: string): string {
  return path.join(getSkillsRoot(), assertValidSkillName(name), "SKILL.md");
}

function toRelativePath(filePath: string): string {
  return path.relative(getRepoRoot(), filePath).replace(/\\/g, "/");
}

function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function parseSkillMarkdown(content: string): { description: string; body: string } {
  if (!content.startsWith("---\n")) {
    return { description: "", body: content };
  }

  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return { description: "", body: content };
  }

  const frontmatter = content.slice(4, endIndex).split(/\r?\n/u);
  const body = content.slice(endIndex + "\n---\n".length);
  const descriptionLine = frontmatter.find((line) => line.trim().startsWith("description:"));
  const description = descriptionLine
    ? descriptionLine.slice(descriptionLine.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "")
    : "";
  return { description, body };
}

function buildSkillMarkdown(params: {
  name: string;
  description: string;
  body: string;
}): string {
  return [
    "---",
    `name: ${params.name}`,
    `description: ${params.description.replace(/\r?\n/gu, " ").trim()}`,
    "---",
    "",
    params.body.trim(),
    "",
  ].join("\n");
}

async function readSkillDetail(name: string): Promise<ProjectSkillDetail> {
  const normalizedName = assertValidSkillName(name);
  const skillPath = getSkillPath(normalizedName);
  const [content, stat] = await Promise.all([
    fs.promises.readFile(skillPath, "utf8"),
    fs.promises.stat(skillPath),
  ]);
  const parsed = parseSkillMarkdown(content);
  return {
    name: normalizedName,
    description: parsed.description,
    relativePath: toRelativePath(skillPath),
    hash: computeHash(content),
    updatedAt: stat.mtime.toISOString(),
    content,
    body: parsed.body,
  };
}

function composeSkillTestPrompt(params: { skill: ProjectSkillDetail; message: string }): string {
  return [
    "Use the following project skill instructions for this test run.",
    "Return a concise answer that visibly reflects the selected skill.",
    "",
    "Selected skill:",
    params.skill.content,
    "",
    "User test message:",
    params.message,
  ].join("\n");
}

export async function listProjectSkills(): Promise<readonly ProjectSkillSummary[]> {
  const skillsRoot = getSkillsRoot();
  await fs.promises.mkdir(skillsRoot, { recursive: true });
  const entries = await fs.promises.readdir(skillsRoot, { withFileTypes: true });
  const details = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && SKILL_NAME_RE.test(entry.name))
      .map((entry) => readSkillDetail(entry.name).catch(() => undefined)),
  );

  return details
    .filter((detail): detail is ProjectSkillDetail => Boolean(detail))
    .map(({ content: _content, body: _body, ...summary }) => summary)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getProjectSkill(name: string): Promise<ProjectSkillDetail> {
  return readSkillDetail(name);
}

export async function upsertProjectSkill(params: {
  name: string;
  description?: string;
  content?: string;
  body?: string;
}): Promise<ProjectSkillDetail> {
  const name = assertValidSkillName(params.name);
  const skillPath = getSkillPath(name);
  const content = params.content?.trim()
    ? `${params.content.trim()}\n`
    : buildSkillMarkdown({
        name,
        description: params.description?.trim() || "Project skill for black_bean_sprouts.",
        body: params.body?.trim() || "# Instructions\n\nDescribe how this skill should guide the agent.",
      });

  await fs.promises.mkdir(path.dirname(skillPath), { recursive: true });
  await fs.promises.writeFile(skillPath, content, "utf8");
  return readSkillDetail(name);
}

export async function deleteProjectSkill(name: string): Promise<{ deleted: true; name: string }> {
  const normalizedName = assertValidSkillName(name);
  const skillDir = path.dirname(getSkillPath(normalizedName));
  await fs.promises.rm(skillDir, { recursive: true, force: true });
  return { deleted: true, name: normalizedName };
}

export async function testProjectSkills(params: {
  skillNames: readonly string[];
  message: string;
  live?: boolean;
}): Promise<readonly ProjectSkillTestResult[]> {
  const message = params.message.trim();
  if (!message) {
    throw new Error("message is required");
  }

  const skills = await Promise.all(params.skillNames.map((name) => readSkillDetail(name)));
  const mode = params.live ? "live" : "dry-run";
  const results: ProjectSkillTestResult[] = [];

  for (const skill of skills) {
    const prompt = composeSkillTestPrompt({ skill, message });
    if (!params.live) {
      results.push({
        skillName: skill.name,
        mode,
        promptPreview: prompt,
      });
      continue;
    }

    const reply = await runClaudeCodeTextPrompt({
      message: prompt,
      sessionKey: `project-skill-test:${skill.name}:${computeHash(message)}`,
    });
    results.push({
      skillName: skill.name,
      mode,
      promptPreview: prompt,
      reply,
    });
  }

  return results;
}
