import { PrismaClient } from "@prisma/client";

export type StyleProfileInput = {
  name: string;
  dsl: Record<string, unknown>;
};

export type DocTypeInput = {
  name: string;
  description?: string;
  enabled?: boolean;
};

export type SkillInput = {
  name: string;
  description?: string;
  tools: readonly string[];
  enabled?: boolean;
};

export type AdminApplicationService = {
  // StyleProfile
  listStyleProfiles(): Promise<readonly unknown[]>;
  createStyleProfile(input: StyleProfileInput): Promise<unknown>;
  updateStyleProfile(id: string, input: Partial<StyleProfileInput>): Promise<unknown>;
  toggleStyleProfile(id: string, enabled: boolean): Promise<unknown>;

  // DocType
  listDocTypes(): Promise<readonly unknown[]>;
  createDocType(input: DocTypeInput): Promise<unknown>;
  updateDocType(id: string, input: Partial<DocTypeInput>): Promise<unknown>;
  toggleDocType(id: string, enabled: boolean): Promise<unknown>;

  // Skill
  listSkills(): Promise<readonly unknown[]>;
  createSkill(input: SkillInput): Promise<unknown>;
  updateSkill(id: string, input: Partial<SkillInput>): Promise<unknown>;
  toggleSkill(id: string, enabled: boolean): Promise<unknown>;
};

function computeSimpleHash(dsl: Record<string, unknown>): string {
  const json = JSON.stringify(dsl);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

export function createAdminService(prisma: PrismaClient): AdminApplicationService {
  return {
    async listStyleProfiles() {
      return prisma.styleProfile.findMany();
    },
    async createStyleProfile(input) {
      return prisma.styleProfile.create({
        data: { name: input.name, dsl: input.dsl as any, hash: computeSimpleHash(input.dsl) }
      });
    },
    async updateStyleProfile(id, input) {
      return prisma.styleProfile.update({
        where: { id },
        data: { name: input.name, dsl: input.dsl as any }
      });
    },
    async toggleStyleProfile(id, enabled) {
      return prisma.styleProfile.update({
        where: { id },
        data: { enabled }
      });
    },

    async listDocTypes() {
      return prisma.docType.findMany();
    },
    async createDocType(input) {
      return prisma.docType.create({
        data: { name: input.name, description: input.description, enabled: input.enabled ?? true }
      });
    },
    async updateDocType(id, input) {
      return prisma.docType.update({
        where: { id },
        data: { name: input.name, description: input.description, enabled: input.enabled }
      });
    },
    async toggleDocType(id, enabled) {
      return prisma.docType.update({
        where: { id },
        data: { enabled }
      });
    },

    async listSkills() {
      return prisma.skill.findMany();
    },
    async createSkill(input) {
      return prisma.skill.create({
        data: { name: input.name, description: input.description, tools: input.tools as any, enabled: input.enabled ?? true }
      });
    },
    async updateSkill(id, input) {
      return prisma.skill.update({
        where: { id },
        data: { name: input.name, description: input.description, tools: input.tools as any }
      });
    },
    async toggleSkill(id, enabled) {
      return prisma.skill.update({
        where: { id },
        data: { enabled }
      });
    },
  };
}
