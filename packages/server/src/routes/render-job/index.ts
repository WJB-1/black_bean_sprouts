import type { FastifyPluginAsync } from "fastify";
import type { RenderApplicationService } from "../../services/render-application.js";

export type RenderJobRouteDeps = {
  readonly renderService: RenderApplicationService;
};

export function createRenderJobRoutes(deps: RenderJobRouteDeps): FastifyPluginAsync {
  const { renderService } = deps;

  return async (app) => {
    // Get render job status
    app.get<{
      Params: { id: string };
    }>("/:id", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const userId = (req.user as { sub: string } | undefined)?.sub;

      if (!userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { id: jobId } = req.params;

      try {
        const status = await renderService.getRenderStatus(jobId);
        return { id: jobId, ...status };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.status(404).send({ error: message });
      }
    });

    // Download the rendered file
    app.get<{
      Params: { id: string };
    }>("/:id/download", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const userId = (req.user as { sub: string } | undefined)?.sub;

      if (!userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { id: jobId } = req.params;

      try {
        const signedUrl = await renderService.getDownloadUrl(jobId, userId);
        // Return the signed URL as a JSON response so the client can redirect.
        // Alternatively, could use reply.redirect(signedUrl) for a server-side redirect.
        return { url: signedUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        if (message.startsWith("Forbidden")) {
          return reply.status(403).send({ error: message });
        }

        if (message.includes("not found")) {
          return reply.status(404).send({ error: message });
        }

        return reply.status(400).send({ error: message });
      }
    });
  };
}
