import type { FastifyPluginAsync } from "fastify";
import { isValidDoc, type Doc } from "@black-bean-sprouts/doc-schema";
import type { RenderApplicationService } from "../../services/render-application.js";
import { PrismaClient } from "@prisma/client";
import { createPatchRoutes, type PatchRouteDeps } from "./patches.js";
import { createRenderRoute } from "./render.js";

export type DocumentRouteDeps = {
  readonly renderService: RenderApplicationService;
  readonly prisma: PrismaClient;
};

export function createDocumentRoutes(deps: DocumentRouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { limit?: string } }>("/", async (req) => {
      const rawLimit = Number.parseInt(req.query?.limit ?? "12", 10);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(50, rawLimit))
        : 12;

      const documents = await deps.prisma.document.findMany({
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          version: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      return documents.map((document) => ({
        id: document.id,
        title: document.title,
        version: document.version,
        updatedAt: document.updatedAt,
        createdAt: document.createdAt,
      }));
    });

    app.post<{ Body: { title?: string; content?: Doc } }>("/", async (req, reply) => {
      const content = req.body?.content;
      if (!content) {
        return reply.status(400).send({ error: "content is required" });
      }

      const validation = isValidDoc(content);
      if (!validation.ok) {
        return reply.status(400).send({
          error: "Invalid document AST",
          details: validation.errors,
        });
      }

      const user = await deps.prisma.user.upsert({
        where: { email: "local-workbench@black-bean-sprouts.local" },
        update: {
          name: "Local Workbench",
        },
        create: {
          email: "local-workbench@black-bean-sprouts.local",
          name: "Local Workbench",
          role: "USER",
        },
      });

      const title = req.body?.title?.trim() || content.metadata.title || "Untitled document";
      const document = await deps.prisma.document.create({
        data: {
          title,
          userId: user.id,
          version: typeof content.version === "number" ? content.version : 0,
          content: content as any,
        },
      });

      return {
        id: document.id,
        version: document.version,
        content: document.content,
      };
    });

    const patchDeps: PatchRouteDeps = { prisma: deps.prisma };
    app.register(createPatchRoutes(patchDeps));
    app.register(createRenderRoute({ renderService: deps.renderService }));
  };
}
