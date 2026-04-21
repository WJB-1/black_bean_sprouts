import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export default async function skillRoutes(fastify: FastifyInstance) {
  // List all skills
  fastify.get("/skills", async () => {
    return await prisma.skill.findMany({
      include: { docType: true },
      orderBy: { code: "asc" },
    });
  });

  // Get single skill
  fastify.get<{ Params: { id: string } }>("/skills/:id", async (request, reply) => {
    const { id } = request.params;
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: { docType: true },
    });
    if (!skill) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "技能不存在" },
      });
    }
    return skill;
  });

  // Create skill
  fastify.post<{
    Body: {
      code: string;
      name: string;
      description?: string | null;
      prompt: string;
      tools: string[];
      docTypeId?: string | null;
    };
  }>(
    "/skills",
    {
      schema: {
        body: {
          type: "object",
          required: ["code", "name", "prompt", "tools"],
          properties: {
            code: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            prompt: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            docTypeId: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as {
        code: string;
        name: string;
        description?: string | null;
        prompt: string;
        tools: string[];
        docTypeId?: string | null;
      };
      const data: Prisma.SkillCreateInput = {
        code: body.code,
        name: body.name,
        prompt: body.prompt,
        tools: body.tools as unknown as Prisma.JsonObject,
      };
      if (body.description !== undefined) {
        data.description = body.description;
      }
      if (body.docTypeId) {
        data.docType = { connect: { id: body.docTypeId } };
      }
      return await prisma.skill.create({ data });
    }
  );

  // Update skill
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string | null;
      prompt?: string;
      tools?: string[];
      docTypeId?: string | null;
      isActive?: boolean;
    };
  }>(
    "/skills/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            prompt: { type: "string" },
            tools: { type: "array", items: { type: "string" } },
            docTypeId: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as {
        name?: string;
        description?: string | null;
        prompt?: string;
        tools?: string[];
        docTypeId?: string | null;
        isActive?: boolean;
      };
      const data: Prisma.SkillUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.prompt !== undefined) data.prompt = body.prompt;
      if (body.tools !== undefined) data.tools = body.tools as unknown as Prisma.JsonObject;
      if (body.docTypeId !== undefined) {
        data.docType = body.docTypeId ? { connect: { id: body.docTypeId } } : { disconnect: true };
      }
      if (body.isActive !== undefined) data.isActive = body.isActive;
      try {
        return await prisma.skill.update({
          where: { id },
          data,
        });
      } catch {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "技能不存在" },
        });
      }
    }
  );

  // Delete skill
  fastify.delete<{ Params: { id: string } }>("/skills/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      await prisma.skill.delete({
        where: { id },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "技能不存在" },
      });
    }
  });
}
