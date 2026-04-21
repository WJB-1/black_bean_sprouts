import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { FastifyError } from "@fastify/error";
import { loadEnv } from "./env.js";
import { AppError } from "./lib/errors.js";
import registerCors from "./plugins/cors.js";
import registerAuth from "./plugins/auth.js";
import authRoutes from "./routes/auth/index.js";
import agentRoutes from "./routes/agent/index.js";
import documentRoutes from "./routes/document/index.js";
import renderRoutes from "./routes/document/render.js";
import adminRoutes from "./routes/admin/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();
  const fastify = Fastify({ logger: env.NODE_ENV === "development" });

  // Plugins
  await registerCors(fastify);
  await registerAuth(fastify);

  // Routes
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(agentRoutes, { prefix: "/api/agent" });
  await fastify.register(documentRoutes, { prefix: "/api/documents" });
  await fastify.register(renderRoutes, { prefix: "/api/documents" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });

  // Error handler
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    if (error.validation) {
      // TypeBox validation errors
      void reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "请求参数格式错误",
          details: error.validation,
        },
      });
      return;
    }

    if (error.code === "FST_JWT_NO_AUTHORIZATION_HEADER" || error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
      void reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "请先登录" },
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
