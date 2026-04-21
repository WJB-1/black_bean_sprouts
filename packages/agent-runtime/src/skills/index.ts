export { thesisSkill } from "./thesis.js";
export type { SkillDefinition } from "./types.js";

import type { SkillDefinition } from "./types.js";
import { thesisSkill } from "./thesis.js";

const allSkills = new Map<string, SkillDefinition>();

export function registerSkill(skill: SkillDefinition): void {
  allSkills.set(skill.code, skill);
}

export function getSkill(code: string): SkillDefinition | undefined {
  return allSkills.get(code);
}

// Register built-in skills
registerSkill(thesisSkill);
