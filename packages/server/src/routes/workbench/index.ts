import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { isValidDoc, type Doc } from "@black-bean-sprouts/doc-schema";
import type {
  WorkbenchApplicationService,
  WorkbenchGenerateProgress,
  WorkbenchGenerateResult,
} from "../../services/workbench-application.js";

export type WorkbenchRouteDeps = {
  readonly workbenchService: WorkbenchApplicationService;
};

type GenerateJobStatus = "running" | "completed" | "failed" | "cancelled";

type GenerateJobProgress = {
  readonly stage: string;
  readonly message: string;
  readonly progress: number;
};

type GenerateJobProgressEvent = GenerateJobProgress & {
  readonly at: string;
};

type GenerateJob = {
  readonly id: string;
  readonly abortController: AbortController;
  status: GenerateJobStatus;
  progress: GenerateJobProgress;
  history: GenerateJobProgressEvent[];
  result?: WorkbenchGenerateResult;
  error?: string;
  readonly createdAt: string;
  updatedAt: string;
};

const GENERATE_JOB_TTL_MS = 30 * 60 * 1000;
const initialGenerateJobProgress: GenerateJobProgress = {
  stage: "start",
  message: "任务已创建，等待后端调度",
  progress: 0,
};

export function createWorkbenchRoutes(deps: WorkbenchRouteDeps): FastifyPluginAsync {
  const { workbenchService } = deps;
  const generateJobs = new Map<string, GenerateJob>();

  return async (app) => {
    app.get("/style-profiles", async () => workbenchService.listStyleProfiles());

    app.post<{
      Body: { fileName?: string; contentBase64?: string };
    }>(
      "/import",
      {
        bodyLimit: 25 * 1024 * 1024,
      },
      async (req, reply) => {
        const fileName = req.body?.fileName?.trim();
        const contentBase64 = req.body?.contentBase64?.trim();
        if (!fileName) {
          return reply.status(400).send({ error: "fileName is required" });
        }
        if (!contentBase64) {
          return reply.status(400).send({ error: "contentBase64 is required" });
        }

        const result = await workbenchService.importSource({
          fileName,
          contentBase64,
        });
        return result;
      },
    );

    app.post<{
      Body: { rawText?: string; title?: string };
    }>("/generate", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      const result = await workbenchService.generateDocument({
        rawText,
        title: req.body?.title,
      });
      return {
        doc: result.doc,
        degraded: result.degraded,
        warning: result.warning,
        modelOutput: result.modelOutput,
      };
    });

    app.post<{
      Body: { rawText?: string; title?: string };
    }>("/generate/jobs", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      cleanupGenerateJobs(generateJobs);
      const now = new Date().toISOString();
      const job: GenerateJob = {
        id: randomUUID(),
        abortController: new AbortController(),
        status: "running",
        progress: initialGenerateJobProgress,
        history: [{ ...initialGenerateJobProgress, at: now }],
        createdAt: now,
        updatedAt: now,
      };
      generateJobs.set(job.id, job);
      void runGenerateJob({
        job,
        workbenchService,
        rawText,
        title: req.body?.title,
        logger: app.log,
      });

      return reply.status(202).send(serializeGenerateJob(job));
    });

    app.get<{
      Params: { jobId: string };
    }>("/generate/jobs/:jobId", async (req, reply) => {
      cleanupGenerateJobs(generateJobs);
      const job = generateJobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "generate job not found" });
      }
      return serializeGenerateJob(job);
    });

    app.delete<{
      Params: { jobId: string };
    }>("/generate/jobs/:jobId", async (req, reply) => {
      const job = generateJobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "generate job not found" });
      }
      if (job.status === "running") {
        job.abortController.abort();
        updateGenerateJob(job, {
          status: "cancelled",
          progress: {
            stage: "cancelled",
            message: "生成任务已取消",
            progress: job.progress.progress,
          },
        });
      }
      return serializeGenerateJob(job);
    });

    app.post<{
      Body: { rawText?: string; title?: string };
    }>("/generate/stream", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const writeRecord = (record: Record<string, unknown>) => {
        reply.raw.write(`${JSON.stringify(record)}\n`);
      };

      try {
        const result = await workbenchService.generateDocument({
          rawText,
          title: req.body?.title,
          onProgress: (progress) => {
            writeRecord({ type: "progress", progress });
          },
        });
        writeRecord({
          type: "done",
          doc: result.doc,
          degraded: result.degraded,
          warning: result.warning,
          modelOutput: result.modelOutput,
        });
      } catch (error) {
        writeRecord({
          type: "error",
          error: error instanceof Error ? error.message : "generate failed",
        });
      } finally {
        reply.raw.end();
      }
    });

    app.post<{
      Body: {
        rawText?: string;
        title?: string;
        style?: {
          styleProfileId?: string;
          bodyFontSizePt?: number;
          lineSpacing?: number;
          marginTopMm?: number;
          marginBottomMm?: number;
          marginLeftMm?: number;
          marginRightMm?: number;
        };
      };
    }>("/generate-docx", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      const generated = await workbenchService.generateDocument({
        rawText,
        title: req.body?.title,
        onProgress: (progress) => {
          app.log.info(
            {
              requestId: req.id,
              route: "generate-docx",
              stage: progress.stage,
              progress: progress.progress,
              message: progress.message,
            },
            "workbench generate-docx progress",
          );
        },
      });
      const exported = await workbenchService.exportDocument({
        doc: generated.doc,
        format: "docx",
        style: req.body?.style,
      });

      reply.header("Content-Type", exported.contentType);
      reply.header("Content-Disposition", buildAttachmentDisposition(exported.fileName));
      if (generated.warning) {
        reply.header("X-BBS-Generation-Warning", encodeURIComponent(generated.warning));
      }
      return reply.send(exported.buffer);
    });

    app.post<{
      Body: {
        doc?: Doc;
        format?: "docx" | "latex";
        style?: {
          styleProfileId?: string;
          bodyFontSizePt?: number;
          lineSpacing?: number;
          marginTopMm?: number;
          marginBottomMm?: number;
          marginLeftMm?: number;
          marginRightMm?: number;
        };
      };
    }>("/export", async (req, reply) => {
      const doc = req.body?.doc;
      const format = req.body?.format;
      if (!doc) {
        return reply.status(400).send({ error: "doc is required" });
      }
      if (format !== "docx" && format !== "latex") {
        return reply.status(400).send({ error: "format must be docx or latex" });
      }

      const validation = isValidDoc(doc);
      if (!validation.ok) {
        return reply.status(400).send({
          error: "Invalid document AST",
          details: validation.errors,
        });
      }

      const result = await workbenchService.exportDocument({
        doc,
        format,
        style: req.body?.style,
      });
      reply.header("Content-Type", result.contentType);
      reply.header("Content-Disposition", buildAttachmentDisposition(result.fileName));
      return reply.send(result.buffer);
    });
  };
}

async function runGenerateJob(params: {
  job: GenerateJob;
  workbenchService: WorkbenchApplicationService;
  rawText: string;
  title?: string;
  logger?: {
    info: (payload: Record<string, unknown>, message?: string) => void;
    error: (payload: Record<string, unknown>, message?: string) => void;
  };
}): Promise<void> {
  const { job } = params;
  try {
    const result = await params.workbenchService.generateDocument({
      rawText: params.rawText,
      title: params.title,
      abortSignal: job.abortController.signal,
      onProgress: (progress) => {
        updateGenerateJob(job, {
          progress: toGenerateJobProgress(progress),
        });
        params.logger?.info(
          {
            jobId: job.id,
            stage: progress.stage,
            progress: progress.progress,
            message: progress.message,
          },
          "workbench generate progress",
        );
      },
    });
    if (job.status === "cancelled" || job.abortController.signal.aborted) {
      updateGenerateJob(job, {
        status: "cancelled",
        progress: {
          stage: "cancelled",
          message: "生成任务已取消",
          progress: job.progress.progress,
        },
      });
      return;
    }
    updateGenerateJob(job, {
      status: "completed",
      result,
      progress: { stage: "done", message: "结构化文档生成完成", progress: 100 },
    });
    params.logger?.info(
      {
        jobId: job.id,
        degraded: result.degraded,
        warning: result.warning,
      },
      "workbench generate completed",
    );
  } catch (error) {
    updateGenerateJob(job, {
      status: job.abortController.signal.aborted ? "cancelled" : "failed",
      error: error instanceof Error ? error.message : String(error),
      progress: {
        stage: job.abortController.signal.aborted ? "cancelled" : "failed",
        message: job.abortController.signal.aborted ? "生成任务已取消" : "生成任务失败",
        progress: job.progress.progress,
      },
    });
    params.logger?.error(
      {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "workbench generate failed",
    );
  }
}

function updateGenerateJob(
  job: GenerateJob,
  patch: Partial<Pick<GenerateJob, "status" | "progress" | "result" | "error">>,
): void {
  const updatedAt = new Date().toISOString();
  if (patch.progress) {
    job.history = [...job.history, { ...patch.progress, at: updatedAt }].slice(-200);
  }
  Object.assign(job, patch, { updatedAt });
}

function toGenerateJobProgress(progress: WorkbenchGenerateProgress): GenerateJobProgress {
  return {
    stage: progress.stage,
    message: progress.message,
    progress: progress.progress,
  };
}

function serializeGenerateJob(job: GenerateJob): Record<string, unknown> {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    history: job.history,
    result: job.result
      ? {
          doc: job.result.doc,
          degraded: job.result.degraded,
          warning: job.result.warning,
          modelOutput: job.result.modelOutput,
        }
      : undefined,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function cleanupGenerateJobs(generateJobs: Map<string, GenerateJob>): void {
  const now = Date.now();
  for (const [id, job] of generateJobs) {
    if (job.status === "running") {
      continue;
    }
    if (now - Date.parse(job.updatedAt) > GENERATE_JOB_TTL_MS) {
      generateJobs.delete(id);
    }
  }
}

function buildAttachmentDisposition(fileName: string): string {
  const asciiFallback = toAsciiFileName(fileName);
  const utf8Name = encodeRFC5987Value(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Name}`;
}

function toAsciiFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]+/g, "-")
    .replace(/["\\]/g, "_")
    .replace(/-+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "document";
}

function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
