import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

export default async function docTypeRoutes(fastify: FastifyInstance) {
  // List all doc types
  fastify.get("/doc-types", async () => {
    return await prisma.docType.findMany({
      orderBy: { code: "asc" },
    });
  });

  // Get single doc type
  fastify.get<{ Params: { id: string } }>("/doc-types/:id", async (request, reply) => {
    const { id } = request.params;
    const docType = await prisma.docType.findUnique({
      where: { id },
    });
    if (!docType) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "文档类型不存在" },
      });
    }
    return docType;
  });

  // Create doc type
  fastify.post<{
    Body: { code: string; name: string; description?: string | null };
  }>(
    "/doc-types",
    {
      schema: {
        body: {
          type: "object",
          required: ["code", "name"],
          properties: {
            code: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { code: string; name: string; description?: string | null };
      return await prisma.docType.create({
        data: {
          code: body.code,
          name: body.name,
          description: body.description ?? null,
        },
      });
    }
  );

  // Update doc type
  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; description?: string | null; isActive?: boolean };
  }>(
    "/doc-types/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { name?: string; description?: string | null; isActive?: boolean };
      try {
        return await prisma.docType.update({
          where: { id },
          data: body,
        });
      } catch {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "文档类型不存在" },
        });
      }
    }
  );

  // Delete doc type
  fastify.delete<{ Params: { id: string } }>("/doc-types/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      await prisma.docType.delete({
        where: { id },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "文档类型不存在" },
      });
    }
  });
}
