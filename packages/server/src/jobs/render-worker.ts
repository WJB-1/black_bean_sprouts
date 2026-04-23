import { Worker } from "bullmq";
import type { RenderJobPayload } from "./render-queue.js";
import type { StorageService } from "../storage/storage-service.js";
import { DocxRenderer } from "@black-bean-sprouts/doc-engine";
import { RenderJobStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { Doc } from "@black-bean-sprouts/doc-schema";
import type { StyleProfileDsl } from "@black-bean-sprouts/doc-engine";

export type RenderWorkerDeps = {
  readonly storageService: StorageService;
  readonly prisma: PrismaClient;
  readonly redisConnection: { host: string; port: number };
};

export function createRenderWorker(deps: RenderWorkerDeps): Worker<RenderJobPayload> {
  const { storageService, prisma, redisConnection } = deps;

  const worker = new Worker<RenderJobPayload>(
    "render",
    async (job) => {
      const { jobId, documentId, userId, format } = job.data;

      // 1. Mark the job as RUNNING
      await prisma.renderJob.update({
        where: { id: jobId },
        data: { status: RenderJobStatus.RUNNING },
      });

      try {
        // 2. Load the document from DB with style profile
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          include: { styleProfile: true },
        });

        if (!document) {
          throw new Error(`Document not found: ${documentId}`);
        }

        if (document.userId !== userId) {
          throw new Error(`User ${userId} does not own document ${documentId}`);
        }

        // 3. Parse document content as Doc AST
        const docContent = document.content as Record<string, unknown>;
        const doc = {
          version: document.version,
          metadata: {
            title: document.title,
            ...(typeof docContent.metadata === "object" && docContent.metadata !== null
              ? docContent.metadata
              : {}),
          },
          children: Array.isArray(docContent.children) ? docContent.children : [],
        } as Doc;

        // 4. Resolve style profile (use document-specific or let DocxRenderer use default)
        const styleProfile: StyleProfileDsl | undefined = document.styleProfile
          ? (document.styleProfile.dsl as StyleProfileDsl)
          : undefined;

        // 5. Render with DocxRenderer (only docx is supported currently)
        if (format !== "docx") {
          throw new Error(`Unsupported render format: ${format}`);
        }

        const renderer = new DocxRenderer(styleProfile);
        const result = await renderer.render(doc);

        // 6. Upload to MinIO
        const objectKey = `renders/${documentId}/${jobId}.docx`;
        await storageService.putObject(
          objectKey,
          result.buffer,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );

        // 7. Update RenderJob status to COMPLETED with resultKey
        await prisma.renderJob.update({
          where: { id: jobId },
          data: {
            status: RenderJobStatus.COMPLETED,
            resultKey: objectKey,
          },
        });

        return { objectKey, size: result.size };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown render error";

        // Update status to FAILED with error message.
        // Swallow DB update failure since the original error is more important.
        await prisma.renderJob.update({
          where: { id: jobId },
          data: {
            status: RenderJobStatus.FAILED,
            error: errorMessage,
          },
        }).catch(() => {});

        throw err; // Re-throw so BullMQ records the failure
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Render job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`Render job ${job?.id} completed successfully`);
  });

  return worker;
}
