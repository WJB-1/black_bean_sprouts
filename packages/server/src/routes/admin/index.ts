import type { FastifyPluginAsync } from "fastify";
import { createAdminService } from "../../services/adminApplication.js";
import { PrismaClient } from "@prisma/client";

export type AdminRouteDeps = {
  readonly prisma: PrismaClient;
};

export function createAdminRoutes(deps: AdminRouteDeps): FastifyPluginAsync {
  return async (app) => {
    const adminService = createAdminService(deps.prisma);

    // All admin routes require authentication and admin role
    app.addHook("onRequest", async (req, reply) => {
      try {
        await req.jwtVerify();
        const user = req.user as { role?: string };
        if (user.role !== "ADMIN") return reply.status(403).send({ error: "Admin access required" });
      } catch { return reply.status(401).send({ error: "Authentication required" }); }
    });

    // ---- StyleProfile CRUD ----
    app.get("/style-profiles", async () => adminService.listStyleProfiles());
    app.post("/style-profiles", async (req) => {
      const { name, dsl } = req.body as { name: string; dsl: Record<string, unknown> };
      if (!name || !dsl) throw { statusCode: 400, message: "name and dsl required" };
      return adminService.createStyleProfile({ name, dsl });
    });
    app.put("/style-profiles/:id", async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as Record<string, unknown>;
      return adminService.updateStyleProfile(id, body);
    });
    app.patch("/style-profiles/:id/toggle", async (req) => {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled: boolean };
      return adminService.toggleStyleProfile(id, enabled);
    });

    // ---- DocType CRUD ----
    app.get("/doc-types", async () => adminService.listDocTypes());
    app.post("/doc-types", async (req) => {
      const { name, description, enabled } = req.body as { name: string; description?: string; enabled?: boolean };
      if (!name) throw { statusCode: 400, message: "name required" };
      return adminService.createDocType({ name, description, enabled });
    });
    app.put("/doc-types/:id", async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as Record<string, unknown>;
      return adminService.updateDocType(id, body);
    });
    app.patch("/doc-types/:id/toggle", async (req) => {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled: boolean };
      return adminService.toggleDocType(id, enabled);
    });

    // ---- Skill CRUD ----
    app.get("/skills", async () => adminService.listSkills());
    app.post("/skills", async (req) => {
      const { name, description, tools } = req.body as { name: string; description?: string; tools: string[] };
      if (!name || !Array.isArray(tools)) throw { statusCode: 400, message: "name and tools[] required" };
      return adminService.createSkill({ name, description, tools });
    });
    app.put("/skills/:id", async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as Record<string, unknown>;
      return adminService.updateSkill(id, body);
    });
    app.patch("/skills/:id/toggle", async (req) => {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled: boolean };
      return adminService.toggleSkill(id, enabled);
    });
  };
}
