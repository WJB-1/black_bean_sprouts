// @doc-schema-version: 1.0.0
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  createKernelSessionEntry,
  resolveLegacySkillsSnapshot,
  withKernelState,
  type KernelEvent,
  type KernelHistoryMessage,
} from "@black-bean-sprouts/xiaolongxia-kernel";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { createToolServices } from "../../services/agent.js";
import { createOrLoadAgentSession, updateAgentSessionWorkingMemory } from "../../services/agentSession.js";
import { createXiaolongxiaRuntime } from "../../services/xiaolongxia.js";

const ChatBody = Type.Object({
  message: Type.String({ minLength: 1 }),
  sessionId: Type.Optional(Type.String()),
  documentId: Type.Optional(Type.String()),
  skillCode: Type.Optional(Type.String()),
});

export default async function chatRoute(fastify: FastifyInstance) {
  fastify.post("/chat", { schema: { body: ChatBody } }, async (request, reply) => {
    const body = request.body as {
      message: string;
      sessionId?: string;
      documentId?: string;
      skillCode?: string;
    };
    const user = request.user as { userId: string };

    setupSse(reply);
    const sendEvent = createEventWriter(reply);
    const abortController = new AbortController();
    reply.raw.on("close", () => {
      abortController.abort();
      reply.raw.end();
    });

    const skillCode = body.skillCode ?? "thesis";
    const skillsSnapshot = resolveLegacySkillsSnapshot(skillCode);
    if (!skillsSnapshot) {
      sendEvent({ type: "error", error: { code: "INVALID_SKILL", message: `未知技能：${skillCode}` } });
      sendEvent(donePayload());
      reply.raw.end();
      return reply;
    }

    try {
      const session = await createOrLoadAgentSession({
        userId: user.userId,
        ...(body.sessionId !== undefined && { sessionId: body.sessionId }),
        ...(body.documentId !== undefined && { documentId: body.documentId }),
      });

      if (session.isNew) {
        sendEvent({ type: "session_created", sessionId: session.id });
      }

      const runId = randomUUID();
      const sessionBase = createKernelSessionEntry({
        sessionId: session.id,
        userId: user.userId,
        documentId: session.documentId,
        skillCode,
        skillsSnapshot,
        workingMemory: session.workingMemory,
      });
      const workingMemory = withKernelState(sessionBase.workingMemory, {
        agentId: sessionBase.agentId,
        sessionKey: sessionBase.sessionKey,
        skillsSnapshot: sessionBase.skillsSnapshot,
        lastRunId: runId,
      });

      await updateAgentSessionWorkingMemory(session.id, workingMemory);
      const history = await loadHistory(session.id);
      await prisma.agentMessage.create({
        data: { sessionId: session.id, role: "USER", content: body.message },
      });

      const runtime = createXiaolongxiaRuntime();
      const stream = runtime.run({
        runId,
        session: { ...sessionBase, workingMemory },
        userMessage: body.message,
        history,
        services: createToolServices(user.userId),
        signal: abortController.signal,
      });

      let assistantText = "";
      const toolCalls: Array<Record<string, unknown>> = [];
      const toolResults: unknown[] = [];

      for await (const event of stream) {
        if (abortController.signal.aborted) {
          break;
        }
        sendEvent(event);
        captureEventState(event, toolCalls, toolResults, (chunk) => {
          assistantText += chunk;
        });
      }

      if (assistantText || toolCalls.length > 0 || toolResults.length > 0) {
        await prisma.agentMessage.create({
          data: {
            sessionId: session.id,
            role: "ASSISTANT",
            content: assistantText || null,
            toolCalls: toolCalls as Prisma.InputJsonValue,
            toolResults: toolResults as Prisma.InputJsonValue,
          },
        });
      }
    } catch (error) {
      await handleRouteError(error, body.message, sendEvent);
    }

    reply.raw.end();
    return reply;
  });
}

function setupSse(reply: FastifyReply): void {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
}

function createEventWriter(reply: FastifyReply): (event: Record<string, unknown>) => boolean {
  let eventId = 0;
  return (event) => {
    try {
      return reply.raw.write(`id: ${eventId++}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      return false;
    }
  };
}

async function loadHistory(sessionId: string): Promise<KernelHistoryMessage[]> {
  const messages = await prisma.agentMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const history: KernelHistoryMessage[] = [];
  for (const message of messages) {
    if (message.role === "USER") {
      history.push({ role: "user", content: message.content ?? "" });
      continue;
    }
    if (message.role === "ASSISTANT") {
      history.push({ role: "assistant", content: message.content ?? "" });
    }
  }
  return history;
}

function captureEventState(
  event: KernelEvent,
  toolCalls: Array<Record<string, unknown>>,
  toolResults: unknown[],
  onText: (chunk: string) => void,
): void {
  if (event.type === "message_delta") {
    onText(event.text);
    return;
  }
  if (event.type === "tool_call_start") {
    toolCalls.push({ tool: event.tool, args: event.args });
    return;
  }
  if (event.type === "tool_call_result") {
    toolResults.push(event.result);
  }
}

async function handleRouteError(
  error: unknown,
  userMessage: string,
  sendEvent: (event: Record<string, unknown>) => boolean,
): Promise<void> {
  if (error instanceof AppError) {
    sendEvent({ type: "error", error: { code: error.code ?? "APP_ERROR", message: error.message } });
    sendEvent(donePayload());
    return;
  }

  const errorMessage = error instanceof Error ? error.message : "Agent 运行出错";
  if (errorMessage.includes("LLM API error") || errorMessage.includes("API key")) {
    sendEvent({
      type: "message_delta",
      text: `已收到你的消息：“${userMessage}”。\n\n当前 LLM 服务未配置或暂不可用，请先在 .env 中设置 LLM_API_KEY。`,
    });
    sendEvent(donePayload());
    return;
  }

  sendEvent({ type: "error", error: { code: "AGENT_ERROR", message: errorMessage } });
  sendEvent(donePayload());
}

function donePayload(): Record<string, unknown> {
  return { type: "done", usage: { inputTokens: 0, outputTokens: 0, model: "" } };
}
