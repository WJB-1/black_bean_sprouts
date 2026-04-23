import type { FastifyPluginAsync } from "fastify";
import type { RenderApplicationService } from "../../services/render-application.js";

export type RenderRouteDeps = {
  readonly renderService: RenderApplicationService;
};

export function createRenderRoute(deps: RenderRouteDeps): FastifyPluginAsync {
  const { renderService } = deps;

  return async (app) => {
    app.post<{
      Params: { id: string };
      Body: { format?: "docx" | "pdf" };
    }>("/:id/render", async (req, reply) => {
      const userId = (req.user as { sub: string } | undefined)?.sub;

      if (!userId) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { id: documentId } = req.params;
      const format = req.body?.format ?? "docx";

      if (format !== "docx" && format !== "pdf") {
        return reply.status(400).send({ error: "Invalid format. Supported: docx, pdf" });
      }

      const result = await renderService.requestRender(documentId, userId, format);
      return reply.status(202).send(result);
    });
  };
}
