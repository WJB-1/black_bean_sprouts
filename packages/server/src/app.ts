import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { FastifyError } from "@fastify/error";
import { loadEnv } from "./env.js";
import { AppError } from "./lib/errors.js";
import registerCors from "./plugins/cors.js";
import registerAuth from "./plugins/auth.js";
import authRoutes from "./routes/auth/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const fastify = Fastify({ logger: env.NODE_ENV === "development" });

  // Plugins
  await registerCors(fastify);
  await registerAuth(fastify);

  // Routes
  await fastify.register(authRoutes, { prefix: "/api/auth" });

  // Error handler
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    if (error.validation) {
      void reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: error.message },
      });
      return;
    }

    fastify.log.error(error);
    void reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
    });
  });

  // Health check
  fastify.get("/api/health", async () => ({ status: "ok" }));

  return fastify;
}
