import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";
import JSZip from "jszip";
import {
  createEmptyDoc,
  isValidDoc,
  type AbstractBlock,
  type BlockNode,
  type Doc,
  type HeadingBlock,
  type InlineNode,
  type ParagraphBlock,
} from "@black-bean-sprouts/doc-schema";
import { runClaudeCodeFilePrompt } from "../../integration/claude-code-runtime.js";
import type {
  WorkbenchApplicationService,
  WorkbenchExportStyleSettings,
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

type WordJobResult = {
  readonly fileName: string;
  readonly outputPath: string;
  readonly workspaceDir: string;
  readonly markdownPath: string;
  readonly contentType: string;
  readonly modelOutput?: string;
};

type WordJob = {
  readonly id: string;
  readonly abortController: AbortController;
  status: GenerateJobStatus;
  progress: GenerateJobProgress;
  history: GenerateJobProgressEvent[];
  result?: WordJobResult;
  error?: string;
  readonly createdAt: string;
  updatedAt: string;
};

type WorkbenchRouteLogger = {
  info: (payload: Record<string, unknown>, message?: string) => void;
  error: (payload: Record<string, unknown>, message?: string) => void;
};

const GENERATE_JOB_TTL_MS = 30 * 60 * 1000;
const WORD_JOB_TTL_MS = 30 * 60 * 1000;
const initialGenerateJobProgress: GenerateJobProgress = {
  stage: "start",
  message: "任务已创建，等待后端调度",
  progress: 0,
};
const initialWordJobProgress: GenerateJobProgress = {
  stage: "queued",
  message: "Word 任务已创建，等待后端调度",
  progress: 0,
};
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "..", "..", "..", "..", "..");

export function createWorkbenchRoutes(deps: WorkbenchRouteDeps): FastifyPluginAsync {
  const { workbenchService } = deps;
  const generateJobs = new Map<string, GenerateJob>();
  const wordJobs = new Map<string, WordJob>();

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
    }>("/generate-docx/jobs", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      cleanupWordJobs(wordJobs);
      const now = new Date().toISOString();
      const job: WordJob = {
        id: randomUUID(),
        abortController: new AbortController(),
        status: "running",
        progress: initialWordJobProgress,
        history: [{ ...initialWordJobProgress, at: now }],
        createdAt: now,
        updatedAt: now,
      };
      wordJobs.set(job.id, job);
      void runWordJob({
        job,
        workbenchService,
        rawText,
        title: req.body?.title,
        style: req.body?.style,
        logger: app.log,
      });

      return reply.status(202).send(serializeWordJob(job));
    });

    app.get<{
      Params: { jobId: string };
    }>("/generate-docx/jobs/:jobId", async (req, reply) => {
      cleanupWordJobs(wordJobs);
      const job = wordJobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "word job not found" });
      }
      return serializeWordJob(job);
    });

    app.delete<{
      Params: { jobId: string };
    }>("/generate-docx/jobs/:jobId", async (req, reply) => {
      const job = wordJobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "word job not found" });
      }
      if (job.status === "running") {
        job.abortController.abort();
        updateWordJob(job, {
          status: "cancelled",
          progress: {
            stage: "cancelled",
            message: "Word 生成任务已取消",
            progress: job.progress.progress,
          },
        });
      }
      return serializeWordJob(job);
    });

    app.get<{
      Params: { jobId: string };
    }>("/generate-docx/jobs/:jobId/download", async (req, reply) => {
      cleanupWordJobs(wordJobs);
      const job = wordJobs.get(req.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "word job not found" });
      }
      if (job.status !== "completed" || !job.result) {
        return reply.status(409).send({ error: "word job is not completed" });
      }

      const buffer = await fs.promises.readFile(job.result.outputPath);
      reply.header("Content-Type", job.result.contentType);
      reply.header("Content-Disposition", buildAttachmentDisposition(job.result.fileName));
      reply.header("X-BBS-Word-Workspace", encodeURIComponent(job.result.workspaceDir));
      return reply.send(buffer);
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

      const job: WordJob = {
        id: randomUUID(),
        abortController: new AbortController(),
        status: "running",
        progress: initialWordJobProgress,
        history: [{ ...initialWordJobProgress, at: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await runWordJob({
        job,
        workbenchService,
        rawText,
        title: req.body?.title,
        style: req.body?.style,
        logger: {
          info: (payload, message) => app.log.info({ requestId: req.id, ...payload }, message),
          error: (payload, message) => app.log.error({ requestId: req.id, ...payload }, message),
        },
      });

      if (job.status !== "completed" || !job.result) {
        return reply.status(500).send({ error: job.error ?? "Word generation failed" });
      }

      const buffer = await fs.promises.readFile(job.result.outputPath);
      reply.header("Content-Type", job.result.contentType);
      reply.header("Content-Disposition", buildAttachmentDisposition(job.result.fileName));
      reply.header("X-BBS-Word-Workspace", encodeURIComponent(job.result.workspaceDir));
      return reply.send(buffer);
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
    }>("/generate-docx/legacy", async (req, reply) => {
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
              route: "generate-docx/legacy",
              stage: progress.stage,
              progress: progress.progress,
              message: progress.message,
            },
            "workbench generate-docx legacy progress",
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
  logger?: WorkbenchRouteLogger;
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

async function runWordJob(params: {
  job: WordJob;
  workbenchService: WorkbenchApplicationService;
  rawText: string;
  title?: string;
  style?: WorkbenchExportStyleSettings;
  logger?: WorkbenchRouteLogger;
}): Promise<void> {
  const { job } = params;
  const workspaceDir = path.join(repoRoot, ".tmp", "workbench-runs", job.id);
  const sourcePath = path.join(workspaceDir, "source.md");
  const skillPath = path.join(workspaceDir, "SKILL.md");
  const stylePath = path.join(workspaceDir, "style.json");
  const taskPath = path.join(workspaceDir, "task.md");
  const resultPath = path.join(workspaceDir, "result.md");
  const outputPath = path.join(workspaceDir, "output.docx");
  const title = normalizeTitle(params.title ?? deriveTitleFromRawText(params.rawText));

  const emit = (progress: GenerateJobProgress) => {
    updateWordJob(job, { progress });
    params.logger?.info(
      {
        jobId: job.id,
        route: "generate-docx-file",
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
      },
      "workbench word progress",
    );
  };

  try {
    emit({ stage: "workspace", message: "正在创建 Word 工作目录", progress: 5 });
    await fs.promises.mkdir(workspaceDir, { recursive: true });
    await fs.promises.writeFile(sourcePath, params.rawText, "utf8");
    await fs.promises.writeFile(stylePath, `${JSON.stringify(params.style ?? {}, null, 2)}\n`, "utf8");
    await fs.promises.copyFile(path.join(repoRoot, "skills", "workbench-word", "SKILL.md"), skillPath);
    await fs.promises.writeFile(
      taskPath,
      buildWordTaskInstructions({
        title,
        sourcePath: path.basename(sourcePath),
        resultPath: path.basename(resultPath),
        stylePath: path.basename(stylePath),
      }),
      "utf8",
    );

    emit({ stage: "claude", message: "Claude 正在按 Skill 编辑 result.md", progress: 20 });
    const modelOutput = await runClaudeCodeFilePrompt({
      cwd: workspaceDir,
      sessionKey: `workbench:word:${job.id}`,
      abortSignal: job.abortController.signal,
      message: buildWordClaudePrompt(),
      onProgress: (event) => {
        updateWordJob(job, { progress: toWordPromptProgress(event) });
      },
    });

    emit({ stage: "read-result", message: "正在读取 Claude 写入的 result.md", progress: 70 });
    const markdown = await fs.promises.readFile(resultPath, "utf8");
    const normalizedMarkdown = markdown.trim();
    if (!normalizedMarkdown) {
      throw new Error("Claude did not write non-empty result.md.");
    }

    emit({ stage: "render-docx", message: "正在将 result.md 渲染为 Word", progress: 80 });
    const doc = markdownToDoc(normalizedMarkdown, title);
    const exported = await params.workbenchService.exportDocument({
      doc,
      format: "docx",
      style: params.style,
    });
    await fs.promises.writeFile(outputPath, exported.buffer);

    emit({ stage: "validate-docx", message: "正在校验 Word 文件结构", progress: 92 });
    await validateDocxBuffer(exported.buffer);

    updateWordJob(job, {
      status: "completed",
      result: {
        fileName: exported.fileName,
        outputPath,
        workspaceDir,
        markdownPath: resultPath,
        contentType: exported.contentType,
        modelOutput,
      },
      progress: { stage: "done", message: "Word 文件生成完成", progress: 100 },
    });
    params.logger?.info(
      {
        jobId: job.id,
        workspaceDir,
        outputPath,
        fileName: exported.fileName,
      },
      "workbench word completed",
    );
  } catch (error) {
    updateWordJob(job, {
      status: job.abortController.signal.aborted ? "cancelled" : "failed",
      error: error instanceof Error ? error.message : String(error),
      progress: {
        stage: job.abortController.signal.aborted ? "cancelled" : "failed",
        message: job.abortController.signal.aborted ? "Word 生成任务已取消" : "Word 生成任务失败",
        progress: job.progress.progress,
      },
    });
    params.logger?.error(
      {
        jobId: job.id,
        workspaceDir,
        error: error instanceof Error ? error.message : String(error),
      },
      "workbench word failed",
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

function updateWordJob(
  job: WordJob,
  patch: Partial<Pick<WordJob, "status" | "progress" | "result" | "error">>,
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

function toWordPromptProgress(event: unknown): GenerateJobProgress {
  const record = asUnknownRecord(event);
  const type = typeof record?.type === "string" ? record.type : "event";
  const subtype = typeof record?.subtype === "string" ? record.subtype : undefined;
  const resultText = typeof record?.result === "string" ? record.result.trim() : "";

  if (type === "system") {
    return {
      stage: "claude",
      message: subtype ? `Claude Code 已启动：${subtype}` : "Claude Code 已启动",
      progress: 30,
    };
  }

  if (type === "process") {
    const elapsedMs = typeof record?.elapsed_ms === "number" ? record.elapsed_ms : 0;
    const timeoutMs = typeof record?.timeout_ms === "number" ? record.timeout_ms : 0;
    const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));
    const timeoutSeconds = Math.max(0, Math.round(timeoutMs / 1000));
    return {
      stage: "claude",
      message:
        record?.subtype === "heartbeat"
          ? `Claude 正在编辑文件：${elapsedSeconds}s / ${timeoutSeconds}s`
          : `Claude 子进程已启动，超时上限 ${timeoutSeconds}s`,
      progress: record?.subtype === "heartbeat" ? 45 : 25,
    };
  }

  if (type === "assistant") {
    return {
      stage: "claude",
      message: "Claude 正在写入 result.md",
      progress: 55,
    };
  }

  if (type === "result") {
    return {
      stage: "claude",
      message: resultText.startsWith("Not logged in")
        ? "Claude 返回登录/鉴权错误"
        : "Claude 已完成文件编辑",
      progress: 68,
    };
  }

  return {
    stage: "claude",
    message: `Claude 事件：${type}`,
    progress: 45,
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

function serializeWordJob(job: WordJob): Record<string, unknown> {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    history: job.history,
    result: job.result
      ? {
          fileName: job.result.fileName,
          workspaceDir: job.result.workspaceDir,
          markdownPath: job.result.markdownPath,
          contentType: job.result.contentType,
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

function cleanupWordJobs(wordJobs: Map<string, WordJob>): void {
  const now = Date.now();
  for (const [id, job] of wordJobs) {
    if (job.status === "running") {
      continue;
    }
    if (now - Date.parse(job.updatedAt) > WORD_JOB_TTL_MS) {
      wordJobs.delete(id);
    }
  }
}

function asUnknownRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function buildWordTaskInstructions(params: {
  title: string;
  sourcePath: string;
  resultPath: string;
  stylePath: string;
}): string {
  return [
    "# Workbench Word Task",
    "",
    `Target title: ${params.title}`,
    `Source file: ${params.sourcePath}`,
    `Style hints: ${params.stylePath}`,
    `Required output file: ${params.resultPath}`,
    "",
    "Read SKILL.md first, then read the source and style hints.",
    "Create or edit result.md until it is a polished Word-ready Markdown document.",
    "Do not return the document body in your chat response.",
  ].join("\n");
}

function buildWordClaudePrompt(): string {
  return [
    "You are running inside an isolated workbench task directory.",
    "Follow SKILL.md exactly.",
    "Read task.md, source.md, and style.json.",
    "Write the final Word-ready Markdown document to result.md.",
    "Do not output JSON.",
    "Do not write the final document in the chat response.",
    "When result.md is complete, reply with one short sentence.",
  ].join("\n");
}

function markdownToDoc(markdown: string, fallbackTitle: string): Doc {
  const idFactory = createIdFactory();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let paragraphLines: string[] = [];
  let title = normalizeTitle(fallbackTitle);
  let sawTitleHeading = false;

  const flushParagraph = () => {
    const paragraph = normalizeOptionalString(paragraphLines.join(" ").replace(/\s+/g, " "));
    paragraphLines = [];
    if (!paragraph) {
      return;
    }
    const lastBlock = blocks.at(-1);
    if (lastBlock?.type === "heading" && isAbstractHeading(readInlineText(lastBlock.children))) {
      blocks.pop();
      blocks.push(makeAbstractBlock(paragraph, idFactory));
      return;
    }
    blocks.push(makeParagraphBlock(paragraph, idFactory));
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading?.[1] && heading[2]) {
      flushParagraph();
      const level = clampHeadingLevel(heading[1].length);
      const text = stripMarkdownInline(heading[2]);
      if (level === 1 && !sawTitleHeading) {
        title = normalizeTitle(text);
        sawTitleHeading = true;
        continue;
      }
      blocks.push(makeHeadingBlock(level, text, idFactory));
      continue;
    }

    paragraphLines.push(stripMarkdownInline(trimmed));
  }
  flushParagraph();

  return {
    ...createEmptyDoc(title),
    children: blocks.length ? blocks : [makeParagraphBlock(markdown, idFactory)],
  };
}

function makeParagraphBlock(
  text: string,
  createId: (prefix: string) => string,
): ParagraphBlock {
  return {
    type: "paragraph",
    id: createId("p"),
    children: textToInlineNodes(text),
  };
}

function makeHeadingBlock(
  level: HeadingBlock["level"],
  text: string,
  createId: (prefix: string) => string,
): HeadingBlock {
  return {
    type: "heading",
    id: createId("h"),
    level,
    children: textToInlineNodes(text),
  };
}

function makeAbstractBlock(
  text: string,
  createId: (prefix: string) => string,
): AbstractBlock {
  return {
    type: "abstract",
    id: createId("abs"),
    children: [makeParagraphBlock(text, createId)],
  };
}

function textToInlineNodes(text: string): readonly InlineNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const inlines: InlineNode[] = [];
  lines.forEach((line, index) => {
    if (line) {
      inlines.push({ type: "text", text: line });
    }
    if (index < lines.length - 1) {
      inlines.push({ type: "hardBreak" });
    }
  });
  return inlines.length ? inlines : [{ type: "text", text: "" }];
}

function readInlineText(inlines: readonly InlineNode[]): string {
  return inlines
    .map((inline) => (inline.type === "text" ? inline.text : ""))
    .join("")
    .trim();
}

function isAbstractHeading(value: string): boolean {
  return /^(摘要|abstract)$/i.test(value.trim());
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/^\s*[-*+]\s+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function deriveTitleFromRawText(rawText: string): string {
  const firstLine = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "未命名文档";
}

function normalizeTitle(value: string): string {
  return normalizeOptionalString(stripMarkdownInline(value)) ?? "未命名文档";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampHeadingLevel(value: number): HeadingBlock["level"] {
  const normalized = Math.min(6, Math.max(1, Math.trunc(value)));
  return normalized as HeadingBlock["level"];
}

function createIdFactory(): (prefix: string) => string {
  const used = new Set<string>();
  let seq = 0;
  return (prefix: string) => {
    let candidate = `${prefix}-${seq++}`;
    while (used.has(candidate)) {
      candidate = `${prefix}-${seq++}`;
    }
    used.add(candidate);
    return candidate;
  };
}

async function validateDocxBuffer(buffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml?.includes("<w:document")) {
    throw new Error("Generated DOCX is missing word/document.xml.");
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
