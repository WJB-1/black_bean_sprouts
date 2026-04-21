import type { FastifyInstance } from "fastify";
import chatRoute from "./chat.js";
import sessionRoutes from "./session.js";

export default async function agentRoutes(fastify: FastifyInstance) {
  // All agent routes require auth
  fastify.addHook("preHandler", fastify.authenticate);

  await fastify.register(chatRoute);
  await fastify.register(sessionRoutes);
}
