import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createIntegrationGateway } from "../../integration/integration-gateway.js";
import { runAutonomousDocumentRepair } from "../../services/agent-document-autonomy.js";
import {
  prepareAgentDocumentWorkspace,
  persistAgentDocumentWorkspace,
  readAgentDocumentSnapshot,
  type AgentDocumentPersistResult,
  type AgentDocumentSnapshot,
  type AgentDocumentWorkspaceContext,
} from "../../services/agent-document-workspace.js";

type AgentChatBody = {
  message: string;
  sessionId?: string;
  sessionKey?: string;
  documentId?: string;
};

type AgentRunResult = {
  readonly reply: string;
  readonly events: unknown[];
};

type AgentRouteDeps = {
  readonly prisma: PrismaClient;
};

type StreamDocumentContext = AgentDocumentWorkspaceContext & {
  lastSnapshotHash?: string;
};

const SNAPSHOT_MUTATION_TOOL_NAMES = new Set(["write", "edit", "apply_patch"]);

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readAssistantText(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const fullText = normalizeOptionalString(
    typeof record.fullText === "string" ? record.fullText : undefined,
  );
  if (fullText) {
    return fullText;
  }

  const delta = normalizeOptionalString(typeof record.delta === "string" ? record.delta : undefined);
  return delta;
}

function updateAssistantReply(currentReply: string, event: unknown): string {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return currentReply;
  }

  const record = event as Record<string, unknown>;
  if (record.stream !== "assistant") {
    return currentReply;
  }

  const data = asRecord(record.data);
  if (!data) {
    return currentReply;
  }

  const fullText = normalizeOptionalString(
    typeof data.fullText === "string" ? data.fullText : undefined,
  );
  if (fullText) {
    return fullText;
  }

  const delta = normalizeOptionalString(typeof data.delta === "string" ? data.delta : undefined);
  if (delta) {
    return currentReply + delta;
  }

  return currentReply;
}

function shouldRefreshSnapshot(event: unknown): boolean {
  const record = asRecord(event);
  if (!record) {
    return false;
  }

  if (record.stream === "patch") {
    return true;
  }

  if (record.stream !== "tool") {
    return false;
  }

  const data = asRecord(record.data);
  const toolName = normalizeOptionalString(
    typeof data?.toolName === "string"
      ? data.toolName
      : typeof data?.name === "string"
        ? data.name
        : undefined,
  );
  if (!toolName || !SNAPSHOT_MUTATION_TOOL_NAMES.has(toolName)) {
    return false;
  }

  const phase = normalizeOptionalString(typeof data?.phase === "string" ? data.phase : undefined);
  return phase !== "start";
}

function toSnapshotRecord(snapshot: AgentDocumentSnapshot) {
  return {
    type: "snapshot" as const,
    snapshot: {
      workspaceDir: snapshot.workspaceDir,
      documentPath: path.basename(snapshot.documentPath),
      previewPath: path.basename(snapshot.previewPath),
      instructionsPath: path.basename(snapshot.instructionsPath),
      rawJson: snapshot.rawJson,
      previewMarkdown: snapshot.previewMarkdown,
      parseError: snapshot.parseError,
      validationErrors: snapshot.validationErrors,
      title: snapshot.title,
      blockCount: snapshot.blockCount,
      sectionCount: snapshot.sectionCount,
      hash: snapshot.hash,
    },
  };
}

async function emitSnapshotIfChanged(
  context: StreamDocumentContext | undefined,
  writeRecord: (record: Record<string, unknown>) => void,
  force = false,
): Promise<AgentDocumentSnapshot | undefined> {
  if (!context) {
    return undefined;
  }

  const snapshot = await readAgentDocumentSnapshot(context);
  if (!force && snapshot.hash === context.lastSnapshotHash) {
    return snapshot;
  }

  context.lastSnapshotHash = snapshot.hash;
  writeRecord(toSnapshotRecord(snapshot));
  return snapshot;
}

async function collectKernelRun(
  runtime: ReturnType<ReturnType<typeof createIntegrationGateway>["getKernelRuntime"]>,
  body: AgentChatBody,
  onEvent?: (event: unknown, reply: string) => Promise<void> | void,
): Promise<AgentRunResult> {
  const events: unknown[] = [];
  let reply = "";

  for await (const event of runtime.run({
    message: body.message,
    sessionId: body.sessionId,
    sessionKey: body.sessionKey,
    documentId: body.documentId,
  })) {
    events.push(event);
    reply = updateAssistantReply(reply, event);
    await onEvent?.(event, reply);
  }

  return { reply, events };
}

async function prepareDocumentContext(
  prisma: PrismaClient,
  body: AgentChatBody,
): Promise<StreamDocumentContext | undefined> {
  const documentId = normalizeOptionalString(body.documentId);
  if (!documentId) {
    return undefined;
  }

  return {
    ...(await prepareAgentDocumentWorkspace(prisma, {
      documentId,
      sessionKey: body.sessionKey,
    })),
  };
}

function toPersistRecord(
  body: AgentChatBody,
  result: AgentDocumentPersistResult,
): Record<string, unknown> {
  return {
    type: "persisted",
    persisted: result.persisted,
    updated: result.updated,
    version: result.version,
    documentId: body.documentId,
    doc: result.doc,
  };
}

export function createAgentRoutes(deps: AgentRouteDeps): FastifyPluginAsync {
  return async (app) => {
    const gateway = createIntegrationGateway();
    const runtime = gateway.getKernelRuntime();
    const { prisma } = deps;

    app.post("/chat", async (req, reply) => {
      const body = req.body as AgentChatBody;
      if (!body?.message) return reply.status(400).send({ error: "message is required" });

      try {
        const documentContext = await prepareDocumentContext(prisma, body);
        const result = documentContext
          ? await runAutonomousDocumentRepair({
              message: body.message,
              documentContext,
              sessionKey: body.sessionKey,
            })
          : await collectKernelRun(runtime, body);
        const persistedResult = documentContext
          ? await persistAgentDocumentWorkspace(prisma, documentContext)
          : undefined;

        return {
          reply: result.reply,
          events: result.events,
          ...(persistedResult
            ? {
                document: {
                  persisted: persistedResult.persisted,
                  updated: persistedResult.updated,
                  version: persistedResult.version,
                  doc: persistedResult.doc,
                  snapshot: toSnapshotRecord(persistedResult.snapshot).snapshot,
                },
              }
            : {}),
        };
      } catch (error) {
        req.log.error({ err: error }, "agent kernel run failed");
        return reply.status(500).send({
          error: error instanceof Error ? error.message : "agent kernel run failed",
        });
      }
    });

    app.post("/chat/stream", async (req, reply) => {
      const body = req.body as AgentChatBody;
      if (!body?.message) {
        return reply.status(400).send({ error: "message is required" });
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const writeRecord = (record: Record<string, unknown>) => {
        reply.raw.write(JSON.stringify(record) + "\n");
      };

      let documentContext: StreamDocumentContext | undefined;

      try {
        documentContext = await prepareDocumentContext(prisma, body);
        let result: AgentRunResult;

        if (documentContext) {
          await emitSnapshotIfChanged(documentContext, writeRecord, true);
          let currentReply = "";
          result = await runAutonomousDocumentRepair({
            message: body.message,
            documentContext,
            sessionKey: body.sessionKey,
            onEvent: async (event) => {
              const data = asRecord(event.data);
              const fullText = normalizeOptionalString(
                typeof data?.fullText === "string" ? data.fullText : undefined,
              );
              if (event.stream === "assistant" && fullText) {
                currentReply = fullText;
              }
              writeRecord({
                type: "event",
                event,
                reply: currentReply,
              });
            },
            onSnapshot: async (snapshot) => {
              documentContext!.lastSnapshotHash = snapshot.hash;
              writeRecord(toSnapshotRecord(snapshot));
            },
          });
        } else {
          result = await collectKernelRun(runtime, body, async (event, currentReply) => {
            writeRecord({
              type: "event",
              event,
              reply: currentReply,
            });

            if (shouldRefreshSnapshot(event)) {
              await emitSnapshotIfChanged(documentContext, writeRecord);
            }
          });
        }

        const persistedResult = documentContext
          ? await persistAgentDocumentWorkspace(prisma, documentContext)
          : undefined;

        if (persistedResult && documentContext) {
          documentContext.lastSnapshotHash = undefined;
          await emitSnapshotIfChanged(documentContext, writeRecord, true);
          writeRecord(toPersistRecord(body, persistedResult));
        }

        writeRecord({
          type: "done",
          reply: result.reply,
          eventCount: result.events.length,
        });
      } catch (error) {
        req.log.error({ err: error }, "agent kernel stream failed");
        if (documentContext) {
          try {
            documentContext.lastSnapshotHash = undefined;
            await emitSnapshotIfChanged(documentContext, writeRecord, true);
          } catch {
            // ignore snapshot follow-up errors
          }
        }
        writeRecord({
          type: "error",
          error: error instanceof Error ? error.message : "agent kernel run failed",
        });
      } finally {
        reply.raw.end();
      }
    });
  };
}
