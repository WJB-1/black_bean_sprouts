import type { FastifyPluginAsync } from "fastify";
import type { DocumentPatchBatch, Doc } from "@black-bean-sprouts/doc-schema";
import { applyBatch, isPatchConflictError } from "@black-bean-sprouts/doc-schema";
import { PrismaClient } from "@prisma/client";

export type PatchRouteDeps = {
  readonly prisma: PrismaClient;
};

export function createPatchRoutes(deps: PatchRouteDeps): FastifyPluginAsync {
  return async (app) => {
    const { prisma } = deps;

    app.get("/:id", async (req, reply) => {
      const { id } = req.params as { id: string };
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) return reply.status(404).send({ error: "Document not found" });
      return { id: doc.id, version: doc.version, content: doc.content };
    });

    app.patch<{ Params: { id: string }; Body: DocumentPatchBatch }>("/:id/patches", async (req, reply) => {
      const { id } = req.params;
      const batch = req.body;
      if (!batch || typeof batch.expectedVersion !== "number" || !Array.isArray(batch.patches)) {
        return reply.status(400).send({ error: "Invalid DocumentPatchBatch" });
      }

      const row = await prisma.document.findUnique({ where: { id } });
      if (!row) return reply.status(404).send({ error: "Document not found" });

      const doc = row.content as unknown as Doc;
      const result = applyBatch({ ...doc, version: row.version }, batch);

      if (!result.ok) {
        if (isPatchConflictError(result.error)) {
          return reply.status(409).send({ error: result.error.message, currentVersion: result.error.currentVersion });
        }
        return reply.status(400).send({ error: result.error.message });
      }

      await prisma.document.update({
        where: { id },
        data: { content: result.doc as any, version: result.doc.version }
      });
      await prisma.documentPatchRecord.create({
        data: {
          documentId: id,
          expectedVersion: batch.expectedVersion,
          patches: batch.patches as any,
          source: batch.source
        }
      });

      return { ok: true, version: result.doc.version };
    });
  };
}
