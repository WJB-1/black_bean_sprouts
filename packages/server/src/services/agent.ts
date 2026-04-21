import type { ToolServices } from "@black-bean-sprouts/agent-runtime";
import { prisma } from "../lib/prisma.js";
import { getDocument, updateDocumentContent } from "./document.js";

/** Build ToolServices adapter for the agent orchestrator */
export function createToolServices(userId: string): ToolServices {
  return {
    prisma,
    async loadDocument(docId: string) {
      const doc = await getDocument(docId, userId);
      return doc.content as unknown;
    },
    async saveDocument(docId: string, content: unknown) {
      await updateDocumentContent(docId, userId, content);
    },
    async submitRenderJob(docId: string, _format: string) {
      const job = await prisma.renderJob.create({
        data: {
          documentId: docId,
          status: "PENDING",
          format: _format,
        },
      });
      return job.id;
    },
  };
}
