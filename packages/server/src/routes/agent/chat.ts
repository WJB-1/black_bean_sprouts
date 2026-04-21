import type { FastifyInstance } from "fastify";

export default async function chatRoute(fastify: FastifyInstance) {
  fastify.post("/chat", async (request, reply) => {
    type ChatBody = {
      message?: string;
      sessionId?: string;
      documentId?: string;
      skillCode?: string;
    };

    const body = request.body as ChatBody;
    const user = request.user as { userId: string };
    const message = body.message ?? "";
    const documentId = body.documentId ?? "";

    if (!message) {
      return reply.status(400).send({
        error: { code: "MISSING_MESSAGE", message: "缺少消息内容" },
      });
    }

    // Set up SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const eventId = crypto.randomUUID();

    // Send a mock response for now (orchestrator integration later)
    const sendEvent = (event: Record<string, unknown>): void => {
      reply.raw.write(`id: ${eventId}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent({
      type: "message_delta",
      text: `收到消息: "${message}"。Agent 运行时尚未完全集成，这是占位回复。`,
    });
    sendEvent({ type: "done", usage: { inputTokens: 0, outputTokens: 0 } });

    reply.raw.end();
    await reply;
  });
}
