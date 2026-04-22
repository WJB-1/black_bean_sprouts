import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  AgentOrchestrator,
  getSkill,
  OpenAICompatProvider,
  patchDocumentTool,
  queryDocumentTool,
  renderDocumentTool,
  ToolRegistry,
} from "@black-bean-sprouts/agent-runtime";
import { loadEnv } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { createToolServices } from "../../services/agent.js";

const ChatBody = Type.Object({
  message: Type.String({ minLength: 1 }),
  sessionId: Type.Optional(Type.String()),
  documentId: Type.Optional(Type.String()),
  skillCode: Type.Optional(Type.String()),
});

function buildOrchestrator(skillCode: string): {
  orchestrator: AgentOrchestrator;
  skill: NonNullable<ReturnType<typeof getSkill>>;
} | null {
  const env = loadEnv();
  const skill = getSkill(skillCode);
  if (!skill) {
    return null;
  }

  const provider = new OpenAICompatProvider({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
  });

  const registry = new ToolRegistry();
  registry.register(patchDocumentTool);
  registry.register(queryDocumentTool);
  registry.register(renderDocumentTool);

  const maxTurns = Number.parseInt(env.LLM_MAX_TURNS, 10) || 10;

  return {
    orchestrator: new AgentOrchestrator({ provider, registry, skill, maxTurns }),
    skill,
  };
}

export default async function chatRoute(fastify: FastifyInstance) {
  fastify.post("/chat", {
    schema: { body: ChatBody },
  }, async (request, reply) => {
    const body = request.body as {
      message: string;
      sessionId?: string;
      documentId?: string;
      skillCode?: string;
    };
    const user = request.user as { userId: string };

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    let eventId = 0;
    const sendEvent = (event: Record<string, unknown>): boolean => {
      try {
        return reply.raw.write(`id: ${eventId++}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {
        return false;
      }
    };

    const abortController = new AbortController();
    reply.raw.on("close", () => {
      abortController.abort();
      reply.raw.end();
    });

    let sessionId = body.sessionId;
    if (!sessionId) {
      const docId = body.documentId ?? "none";
      const session = await prisma.agentSession.create({
        data: {
          userId: user.userId,
          documentId: docId,
          workingMemory: {},
        },
      });
      sessionId = session.id;
      sendEvent({ type: "session_created", sessionId });
    }

    const dbMessages = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const history = dbMessages
      .filter((message) => message.role === "USER" || message.role === "ASSISTANT")
      .map((message) => ({
        role: (message.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: message.content ?? "",
      }));

    const built = buildOrchestrator(body.skillCode ?? "thesis");
    if (!built) {
      sendEvent({ type: "error", error: { code: "INVALID_SKILL", message: "未知的技能类型" } });
      sendEvent({ type: "done", usage: { inputTokens: 0, outputTokens: 0 } });
      reply.raw.end();
      return reply;
    }

    const services = createToolServices(user.userId);

    try {
      await prisma.agentMessage.create({
        data: {
          sessionId,
          role: "USER",
          content: body.message,
        },
      });

      const stream = built.orchestrator.run({
        sessionId,
        userId: user.userId,
        docId: body.documentId ?? "",
        userMessage: body.message,
        history,
        signal: abortController.signal,
        services,
      });

      let assistantText = "";
      for await (const event of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        sendEvent(event);
        if (event.type === "message_delta") {
          assistantText += event.text;
        }
      }

      if (assistantText) {
        await prisma.agentMessage.create({
          data: {
            sessionId,
            role: "ASSISTANT",
            content: assistantText,
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Agent 运行出错";
      if (errorMessage.includes("LLM API error") || errorMessage.includes("API key")) {
        sendEvent({
          type: "message_delta",
          text: `已收到你的消息：“${body.message}”。\n\n当前 LLM 服务未配置或暂不可用，请在 .env 中设置 LLM_API_KEY。\n支持任意 OpenAI 兼容 API（DeepSeek / MiniMax / OpenAI 等）。`,
        });
      } else {
        sendEvent({ type: "error", error: { code: "AGENT_ERROR", message: errorMessage } });
      }
      sendEvent({ type: "done", usage: { inputTokens: 0, outputTokens: 0 } });
    }

    reply.raw.end();
    return reply;
  });
}
