import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";
import { createDocumentRoutes } from "./routes/document/index.js";
import { agentRoutes } from "./routes/agent/index.js";
import { createAdminRoutes } from "./routes/admin/index.js";
import { createRenderJobRoutes } from "./routes/render-job/index.js";
import { createWorkbenchRoutes } from "./routes/workbench/index.js";
import { createRenderQueue } from "./jobs/render-queue.js";
import { createRenderWorker } from "./jobs/render-worker.js";
import { createRenderApplicationService } from "./services/render-application.js";
import { createWorkbenchApplicationService } from "./services/workbench-application.js";
import { createStorageService } from "./storage/storage-service.js";
import { authPlugin, registerAuthRoutes } from "./plugins/auth.js";
import type { RenderApplicationService } from "./services/render-application.js";

const app = Fastify({ logger: true });

async function start() {
  // --- Infrastructure ---
  const prisma = new PrismaClient();

  const redisConnection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  };

  // --- Render queue, worker, and application service ---
  let renderQueue: ReturnType<typeof createRenderQueue> | undefined;
  let renderWorker: ReturnType<typeof createRenderWorker> | undefined;
  let renderService: RenderApplicationService = createDisabledRenderService();

  try {
    const storageService = await createStorageService();
    renderQueue = createRenderQueue(redisConnection);
    renderWorker = createRenderWorker({
      storageService,
      prisma,
      redisConnection,
    });
    renderService = createRenderApplicationService({
      queue: renderQueue,
      prisma,
      storageService,
    });
  } catch (error) {
    app.log.warn(
      {
        err: error,
      },
      "Render infrastructure unavailable; async render routes stay disabled but workbench remains usable",
    );
  }
  const workbenchService = createWorkbenchApplicationService();

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
  await app.register(createWorkbenchRoutes({ workbenchService }), { prefix: "/api/workbench" });

  // --- Start server ---
  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await renderWorker?.close();
    await renderQueue?.close();
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

function createDisabledRenderService(): RenderApplicationService {
  const error = new Error("Render infrastructure is unavailable in this environment.");
  return {
    async requestRender() {
      throw error;
    },
    async getRenderStatus() {
      throw error;
    },
    async getDownloadUrl() {
      throw error;
    },
  };
}
