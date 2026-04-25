import type { FastifyPluginAsync } from "fastify";
import { isValidDoc, type Doc } from "@black-bean-sprouts/doc-schema";
import type { WorkbenchApplicationService } from "../../services/workbench-application.js";

export type WorkbenchRouteDeps = {
  readonly workbenchService: WorkbenchApplicationService;
};

export function createWorkbenchRoutes(deps: WorkbenchRouteDeps): FastifyPluginAsync {
  const { workbenchService } = deps;

  return async (app) => {
    app.get("/style-profiles", async () => workbenchService.listStyleProfiles());

    app.post<{
      Body: { fileName?: string; contentBase64?: string };
    }>(
      "/import",
      {
        bodyLimit: 25 * 1024 * 1024,
      },
      async (req, reply) => {
        const fileName = req.body?.fileName?.trim();
        const contentBase64 = req.body?.contentBase64?.trim();
        if (!fileName) {
          return reply.status(400).send({ error: "fileName is required" });
        }
        if (!contentBase64) {
          return reply.status(400).send({ error: "contentBase64 is required" });
        }

        const result = await workbenchService.importSource({
          fileName,
          contentBase64,
        });
        return result;
      },
    );

    app.post<{
      Body: { rawText?: string; title?: string };
    }>("/generate", async (req, reply) => {
      const rawText = req.body?.rawText?.trim();
      if (!rawText) {
        return reply.status(400).send({ error: "rawText is required" });
      }

      const result = await workbenchService.generateDocument({
        rawText,
        title: req.body?.title,
      });
      return {
        doc: result.doc,
        degraded: result.degraded,
        warning: result.warning,
        modelOutput: result.modelOutput,
      };
    });

    app.post<{
      Body: {
        doc?: Doc;
        format?: "docx" | "latex";
        style?: {
          styleProfileId?: string;
          bodyFontSizePt?: number;
          lineSpacing?: number;
          marginTopMm?: number;
          marginBottomMm?: number;
          marginLeftMm?: number;
          marginRightMm?: number;
        };
      };
    }>("/export", async (req, reply) => {
      const doc = req.body?.doc;
      const format = req.body?.format;
      if (!doc) {
        return reply.status(400).send({ error: "doc is required" });
      }
      if (format !== "docx" && format !== "latex") {
        return reply.status(400).send({ error: "format must be docx or latex" });
      }

      const validation = isValidDoc(doc);
      if (!validation.ok) {
        return reply.status(400).send({
          error: "Invalid document AST",
          details: validation.errors,
        });
      }

      const result = await workbenchService.exportDocument({
        doc,
        format,
        style: req.body?.style,
      });
      reply.header("Content-Type", result.contentType);
      reply.header("Content-Disposition", buildAttachmentDisposition(result.fileName));
      return reply.send(result.buffer);
    });
  };
}

function buildAttachmentDisposition(fileName: string): string {
  const asciiFallback = toAsciiFileName(fileName);
  const utf8Name = encodeRFC5987Value(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Name}`;
}

function toAsciiFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]+/g, "-")
    .replace(/["\\]/g, "_")
    .replace(/-+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "document";
}

function encodeRFC5987Value(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
