import type { FastifyPluginAsync } from "fastify";
import type { RenderApplicationService } from "../../services/render-application.js";
import { PrismaClient } from "@prisma/client";
import { createPatchRoutes, type PatchRouteDeps } from "./patches.js";
import { createRenderRoute } from "./render.js";

export type DocumentRouteDeps = {
  readonly renderService: RenderApplicationService;
  readonly prisma: PrismaClient;
};

export function createDocumentRoutes(deps: DocumentRouteDeps): FastifyPluginAsync {
  return async (app) => {
    const patchDeps: PatchRouteDeps = { prisma: deps.prisma };
    app.register(createPatchRoutes(patchDeps));
    app.register(createRenderRoute({ renderService: deps.renderService }));
  };
}
