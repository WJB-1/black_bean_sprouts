// @doc-schema-version: 1.0.0
export type SkillsSnapshotSource = {
  skillCode: string;
  tools: readonly string[];
};

export function createSkillsSnapshot(source: SkillsSnapshotSource): readonly string[] {
  const tools = [...new Set(source.tools.map((tool) => tool.trim()).filter(Boolean))].sort();
  return [`skill:${source.skillCode.trim() || "unknown"}`, ...tools.map((tool) => `tool:${tool}`)];
}
