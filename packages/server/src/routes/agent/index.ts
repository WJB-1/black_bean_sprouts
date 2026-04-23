import type { FastifyPluginAsync } from "fastify";
import { createIntegrationGateway } from "../../integration/integration-gateway.js";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const gateway = createIntegrationGateway();
  const runtime = gateway.getKernelRuntime();

  app.post("/chat", async (req, reply) => {
    const { message, sessionId, documentId } = req.body as { message: string; sessionId?: string; documentId?: string };
    if (!message) return reply.status(400).send({ error: "message is required" });
    const events: unknown[] = [];
    for await (const event of runtime.run({ message, sessionId, documentId })) { events.push(event); }
    const last = events.filter((e: any) => e.stream === "assistant").pop();
    return { reply: (last as any)?.data?.fullText ?? "", events };
  });
};
