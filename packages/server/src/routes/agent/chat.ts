import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

const ChatBody = Type.Object({
  message: Type.String({ minLength: 1 }),
  sessionId: Type.Optional(Type.String()),
  documentId: Type.Optional(Type.String()),
  skillCode: Type.Optional(Type.String()),
});

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

    // Set up SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    const eventId = crypto.randomUUID();

    // Send a mock response for now (orchestrator integration later)
    const sendEvent = (event: Record<string, unknown>): boolean => {
      try {
        return reply.raw.write(`id: ${eventId}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {
        // Client disconnected
        return false;
      }
    };

    // Handle client disconnect
    reply.raw.on("close", () => {
      reply.raw.end();
    });

    sendEvent({
      type: "message_delta",
      text: `收到消息: "${body.message}"。Agent 运行时尚未完全集成，这是占位回复。`,
    });
    sendEvent({ type: "done", usage: { inputTokens: 0, outputTokens: 0 } });

    reply.raw.end();
    return reply;
  });
}
