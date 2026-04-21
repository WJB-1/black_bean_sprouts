import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { Doc, StyleProfile } from "@black-bean-sprouts/doc-schema";
import { DocxRenderer } from "@black-bean-sprouts/doc-engine";
import { NumberingResolver } from "@black-bean-sprouts/doc-engine";
import { CitationFormatter } from "@black-bean-sprouts/doc-engine";
import { prisma } from "../../lib/prisma.js";

const ObjectIdPattern = "^[0-9a-fA-F]{24}$";

const DocumentIdParams = Type.Object({
  id: Type.String({ pattern: ObjectIdPattern }),
});

const RenderBody = Type.Object({
  format: Type.Optional(Type.Union([Type.Literal("docx"), Type.Literal("pdf")])),
});

function sanitizeFilename(filename: string): string {
  // Remove any characters that aren't safe for filenames
  return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, "_");
}

export default async function renderRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/:id/render",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: DocumentIdParams,
        body: RenderBody,
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const { format = "docx" } = request.body as { format?: string };

      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc || doc.userId !== user.userId) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: "文档不存在" },
        });
      }

      // Create render job
      const job = await prisma.renderJob.create({
        data: {
          documentId: id,
          format,
          status: "PENDING",
        },
      });

      // Update document status
      await prisma.document.update({
        where: { id },
        data: { status: "RENDERING" },
      });

      // MVP: render synchronously
      try {
        const renderer = new DocxRenderer();
        const docContent = doc.content as unknown as Doc;

        // MVP: use default style profile inline
        const styleProfile = {
          id: "__default__",
          name: "默认样式",
          docTypeCode: "thesis",
          version: "1.0.0",
          page: {
            size: "A4" as const,
            orientation: "portrait" as const,
            margin: { top: "2.54cm", bottom: "2.54cm", left: "3.17cm", right: "3.17cm" },
          },
          fonts: {
            body: { eastAsian: "宋体", latin: "Times New Roman" },
            heading: { eastAsian: "黑体", latin: "Arial" },
            caption: { eastAsian: "宋体", latin: "Times New Roman" },
            monospace: { eastAsian: "宋体", latin: "Courier New" },
            baseSize: 12,
          },
          numbering: {
            section: [{
              levels: [{ style: "arabic" as const }, { style: "arabic" as const }, { style: "arabic" as const }],
              resetOn: "none" as const,
              format: "{n1}.{n2}",
            }],
            figure: { levels: [{ style: "arabic" as const }], resetOn: "section1", format: "图{n1}" },
            table: { levels: [{ style: "arabic" as const }], resetOn: "section1", format: "表{n1}" },
            formula: { levels: [{ style: "arabic" as const }], resetOn: "section1", format: "({n1})" },
            appendix: { levels: [{ style: "letter-upper" as const }], resetOn: "none" as const, format: "附录{n1}" },
            reference: { levels: [{ style: "arabic" as const }], resetOn: "none" as const, format: "[{n1}]" },
          },
          nodes: {
            section: {
              "1": { bold: true, size: 16, align: "center", spaceBefore: "24pt", spaceAfter: "12pt" },
              "2": { bold: true, size: 14, align: "left", spaceBefore: "18pt", spaceAfter: "6pt" },
              "3": { bold: true, size: 12, align: "left", spaceBefore: "12pt", spaceAfter: "6pt" },
            },
            paragraph: {
              normal: { size: 12, lineHeight: 1.5, firstLineIndent: "2em", align: "justify" },
              quote: { size: 12, lineHeight: 1.5, firstLineIndent: "0" },
              code: { font: "Courier New", size: 10 },
              note: { size: 10 },
              caption: { size: 10, align: "center" },
              "list-item": { size: 12, lineHeight: 1.5 },
            },
            figure: { captionPosition: "below", captionStyle: { size: 10, align: "center" } },
            table: { captionPosition: "above", captionStyle: { size: 10, align: "center" }, defaultBorder: "three-line" },
            abstract: {
              titleStyle: { bold: true, size: 16, align: "center" },
              bodyStyle: { size: 12, lineHeight: 1.5 },
              keywordsStyle: { size: 12 },
            },
            cover: { layout: "from-template" },
            formula: { numberingFormat: "({chapter}.{n})" },
            referenceList: { hangingIndent: "2em", fontSize: 10.5 },
          },
          citation: { cslStyleKey: "gb-t-7714-2015-numeric", locale: "zh-CN" },
          isActive: true,
        } satisfies StyleProfile;

        const loadAsset = async (_key: string) => Buffer.from("");

        const numbering = new NumberingResolver();
        const citation = new CitationFormatter();
        citation.indexReferences(Object.values(docContent.references ?? {}), []);

        const buffer = await renderer.render(docContent, {
          styleProfile,
          numberingResolver: numbering,
          citationFormatter: citation,
          loadAsset,
        });

        const storageKey = `renders/${id}/${job.id}.docx`;

        await prisma.renderJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            resultKey: storageKey,
            completedAt: new Date(),
          },
        });
        await prisma.document.update({
          where: { id },
          data: { status: "COMPLETED" },
        });

        // Return buffer directly for download
        void reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        const safeFilename = sanitizeFilename(doc.title ?? "document");
        void reply.header(
          "Content-Disposition",
          `attachment; filename="${safeFilename}.docx"; filename*=UTF-8''${encodeURIComponent(safeFilename)}.docx`,
        );
        return reply.send(buffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : "渲染失败";
        await prisma.renderJob.update({
          where: { id: job.id },
          data: { status: "FAILED", error: message },
        });
        await prisma.document.update({
          where: { id },
          data: { status: "FAILED" },
        });
        return reply.status(500).send({
          error: { code: "RENDER_FAILED", message },
        });
      }
    },
  );
}
