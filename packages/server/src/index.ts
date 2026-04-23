import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";
import { createDocumentRoutes } from "./routes/document/index.js";
import { agentRoutes } from "./routes/agent/index.js";
import { createAdminRoutes } from "./routes/admin/index.js";
import { createRenderJobRoutes } from "./routes/render-job/index.js";
import { createRenderQueue } from "./jobs/render-queue.js";
import { createRenderWorker } from "./jobs/render-worker.js";
import { createRenderApplicationService } from "./services/render-application.js";
import { createStorageService } from "./storage/storage-service.js";
import { authPlugin, registerAuthRoutes } from "./plugins/auth.js";

const app = Fastify({ logger: true });

async function start() {
  // --- Infrastructure ---
  const prisma = new PrismaClient();
  const storageService = await createStorageService();

  const redisConnection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  };

  // --- Render queue, worker, and application service ---
  const renderQueue = createRenderQueue(redisConnection);
  const renderWorker = createRenderWorker({
    storageService,
    prisma,
    redisConnection,
  });
  const renderService = createRenderApplicationService({
    queue: renderQueue,
    prisma,
    storageService,
  });

  // --- Fastify plugins ---
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || "change-me" });
  await app.register(authPlugin);
  await app.register(registerAuthRoutes);

  // --- Route registration ---
  await app.register(createDocumentRoutes({ renderService, prisma }), { prefix: "/api/documents" });
  await app.register(agentRoutes, { prefix: "/api/agent" });
  await app.register(createAdminRoutes({ prisma }), { prefix: "/api/admin" });
  await app.register(createRenderJobRoutes({ renderService }), { prefix: "/api/render-jobs" });

  // --- Start server ---
  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await renderWorker.close();
    await renderQueue.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
