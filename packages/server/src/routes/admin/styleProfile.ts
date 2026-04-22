import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export default async function styleProfileRoutes(fastify: FastifyInstance) {
  fastify.get("/style-profiles", async () => {
    return prisma.styleProfile.findMany({
      orderBy: [{ docTypeCode: "asc" }, { name: "asc" }],
    });
  });

  fastify.get<{ Params: { id: string } }>("/style-profiles/:id", async (request, reply) => {
    const { id } = request.params;
    const profile = await prisma.styleProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "样式模板不存在" },
      });
    }

    return profile;
  });

  fastify.post<{
    Body: {
      name: string;
      docTypeCode: string;
      version: string;
      page: Prisma.InputJsonValue;
      fonts: Prisma.InputJsonValue;
      numbering: Prisma.InputJsonValue;
      nodes: Prisma.InputJsonValue;
      citation: Prisma.InputJsonValue;
    };
  }>(
    "/style-profiles",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "docTypeCode", "version", "page", "fonts", "numbering", "nodes", "citation"],
          properties: {
            name: { type: "string" },
            docTypeCode: { type: "string" },
            version: { type: "string" },
            page: { type: "object" },
            fonts: { type: "object" },
            numbering: { type: "object" },
            nodes: { type: "object" },
            citation: { type: "object" },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as {
        name: string;
        docTypeCode: string;
        version: string;
        page: Prisma.InputJsonValue;
        fonts: Prisma.InputJsonValue;
        numbering: Prisma.InputJsonValue;
        nodes: Prisma.InputJsonValue;
        citation: Prisma.InputJsonValue;
      };

      return prisma.styleProfile.create({
        data: {
          name: body.name,
          docTypeCode: body.docTypeCode,
          version: body.version,
          page: body.page,
          fonts: body.fonts,
          numbering: body.numbering,
          nodes: body.nodes,
          citation: body.citation,
        },
      });
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      page?: Prisma.InputJsonValue;
      fonts?: Prisma.InputJsonValue;
      numbering?: Prisma.InputJsonValue;
      nodes?: Prisma.InputJsonValue;
      citation?: Prisma.InputJsonValue;
      isActive?: boolean;
    };
  }>(
    "/style-profiles/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            page: { type: "object" },
            fonts: { type: "object" },
            numbering: { type: "object" },
            nodes: { type: "object" },
            citation: { type: "object" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as {
        name?: string;
        page?: Prisma.InputJsonValue;
        fonts?: Prisma.InputJsonValue;
        numbering?: Prisma.InputJsonValue;
        nodes?: Prisma.InputJsonValue;
        citation?: Prisma.InputJsonValue;
        isActive?: boolean;
      };

      const data: Prisma.StyleProfileUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.page !== undefined) data.page = body.page;
      if (body.fonts !== undefined) data.fonts = body.fonts;
      if (body.numbering !== undefined) data.numbering = body.numbering;
      if (body.nodes !== undefined) data.nodes = body.nodes;
      if (body.citation !== undefined) data.citation = body.citation;
      if (body.isActive !== undefined) data.isActive = body.isActive;

      try {
        return await prisma.styleProfile.update({
          where: { id },
          data,
        });
      } catch {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "样式模板不存在" },
        });
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>("/style-profiles/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      await prisma.styleProfile.delete({
        where: { id },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "样式模板不存在" },
      });
    }
  });
}
