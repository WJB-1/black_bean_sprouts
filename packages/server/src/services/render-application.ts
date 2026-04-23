import type { Queue } from "bullmq";
import type { RenderJobPayload } from "../jobs/render-queue.js";
import { enqueueRenderJob } from "../jobs/render-queue.js";
import type { StorageService } from "../storage/storage-service.js";
import type { PrismaClient } from "@prisma/client";
import { RenderJobStatus } from "@prisma/client";

// ---- Public service interface ----

export type RenderApplicationService = {
  requestRender(
    documentId: string,
    userId: string,
    format: "docx" | "pdf",
  ): Promise<{ jobId: string; status: "PENDING" }>;

  getRenderStatus(
    jobId: string,
  ): Promise<{ status: string; resultKey?: string; error?: string }>;

  getDownloadUrl(jobId: string, userId: string): Promise<string>;
};

// ---- Factory ----

export type RenderApplicationDeps = {
  readonly queue: Queue<RenderJobPayload>;
  readonly prisma: PrismaClient;
  readonly storageService: StorageService;
};

export function createRenderApplicationService(
  deps: RenderApplicationDeps,
): RenderApplicationService {
  const { queue, prisma, storageService } = deps;

  return {
    async requestRender(documentId, userId, format) {
      // 1. Create a RenderJob record in the database
      const renderJob = await prisma.renderJob.create({
        data: {
          documentId,
          userId,
          format,
          status: RenderJobStatus.PENDING,
        },
      });

      // 2. Enqueue the job for the worker to pick up
      await enqueueRenderJob(queue, {
        jobId: renderJob.id,
        documentId,
        userId,
        format,
      });

      // Use the Prisma record ID as the canonical job ID
      return { jobId: renderJob.id, status: "PENDING" };
    },

    async getRenderStatus(jobId) {
      const renderJob = await prisma.renderJob.findUnique({
        where: { id: jobId },
        select: { status: true, resultKey: true, error: true },
      });

      if (!renderJob) {
        throw new Error(`Render job not found: ${jobId}`);
      }

      return {
        status: renderJob.status,
        resultKey: renderJob.resultKey ?? undefined,
        error: renderJob.error ?? undefined,
      };
    },

    async getDownloadUrl(jobId, userId) {
      const renderJob = await prisma.renderJob.findUnique({
        where: { id: jobId },
        select: { userId: true, resultKey: true, status: true },
      });

      if (!renderJob) {
        throw new Error(`Render job not found: ${jobId}`);
      }

      if (renderJob.userId !== userId) {
        throw new Error("Forbidden: you do not own this render job");
      }

      if (renderJob.status !== RenderJobStatus.COMPLETED || !renderJob.resultKey) {
        throw new Error(`Render job is not completed yet (status: ${renderJob.status})`);
      }

      // Generate a signed URL valid for 5 minutes (300 seconds)
      const signedUrl = await storageService.getSignedUrl(renderJob.resultKey, 300);
      return signedUrl;
    },
  };
}
