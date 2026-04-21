import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export default async function registerCors(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });
}
