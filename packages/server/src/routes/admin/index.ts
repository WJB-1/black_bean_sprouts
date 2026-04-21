import type { FastifyInstance } from "fastify";
import docTypeRoutes from "./docType.js";
import skillRoutes from "./skill.js";
import styleProfileRoutes from "./styleProfile.js";

export default async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require auth
  fastify.addHook("preHandler", fastify.authenticate);

  await fastify.register(docTypeRoutes);
  await fastify.register(skillRoutes);
  await fastify.register(styleProfileRoutes);
}
