import type { FastifyPluginAsync } from "fastify";
import { createIntegrationGateway } from "../../integration/integration-gateway.js";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const gateway = createIntegrationGateway();
  const runtime = gateway.getKernelRuntime();

  app.post("/chat", async (req, reply) => {
    const { message, sessionId, sessionKey, documentId } = req.body as {
      message: string;
      sessionId?: string;
      sessionKey?: string;
      documentId?: string;
    };
    if (!message) return reply.status(400).send({ error: "message is required" });
    const events: unknown[] = [];
    try {
      for await (const event of runtime.run({ message, sessionId, sessionKey, documentId })) {
        events.push(event);
      }
    } catch (error) {
      req.log.error({ err: error }, "agent kernel run failed");
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "agent kernel run failed",
      });
    }
    const last = events.filter((e: any) => e.stream === "assistant").pop();
    return { reply: (last as any)?.data?.fullText ?? "", events };
  });
};
