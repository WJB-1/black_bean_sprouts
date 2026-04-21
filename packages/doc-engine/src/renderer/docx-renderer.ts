import { Document, Packer } from "docx";
import type { Doc, BlockNode } from "@black-bean-sprouts/doc-schema";
import type { InlineNode } from "@black-bean-sprouts/doc-schema";
import { NumberingResolver } from "../numbering/index.js";
import { CitationFormatter } from "../citation/index.js";
import { renderBlock } from "./block-renderer.js";
import type { RenderOptions, RendererContext } from "./types.js";

export class DocxRenderer {
  async render(doc: Doc, options: RenderOptions): Promise<Buffer> {
    const numbering = new NumberingResolver();
    numbering.resolve(doc.content);

    const citation = new CitationFormatter();
    const citationOrder = this.extractCitationOrder(doc);
    citation.indexReferences(Object.values(doc.references), citationOrder);

    const ctx: RendererContext = {
      options,
      style: options.styleProfile,
      numbering,
      citation,
    };

    const children = doc.content.flatMap((node) => renderBlock(node, ctx));

    const document = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
          },
        },
        children,
      }],
    });

    return Packer.toBuffer(document);
  }

  private extractCitationOrder(doc: Doc): string[] {
    const order: string[] = [];
    const seen = new Set<string>();

    const walkInline = (nodes: InlineNode[]): void => {
      for (const node of nodes) {
        if (node.type === "citation_ref" && !seen.has(node.attrs.refId)) {
          order.push(node.attrs.refId);
          seen.add(node.attrs.refId);
        }
      }
    };

    walkInline(this.collectInlines(doc.content));
    return order;
  }

  private collectInlines(nodes: BlockNode[]): InlineNode[] {
    const result: InlineNode[] = [];

    const walkBlock = (blockNodes: BlockNode[]): void => {
      for (const node of blockNodes) {
        if ("content" in node && Array.isArray(node.content)) {
          if (node.type === "paragraph") {
            result.push(...(node.content as InlineNode[]));
          } else if (node.type === "abstract") {
            for (const para of node.content as Array<{ content: InlineNode[] }>) {
              if (para.content && Array.isArray(para.content)) {
                result.push(...para.content);
              }
            }
          } else if (node.type === "table") {
            for (const row of node.content as Array<{ cells: Array<{ content: InlineNode[] }> }>) {
              for (const cell of row.cells) {
                if (cell.content && Array.isArray(cell.content)) {
                  result.push(...cell.content);
                }
              }
            }
          } else if (node.type === "section" || node.type === "appendix") {
            walkBlock(node.content as BlockNode[]);
          }
        }
      }
    };

    walkBlock(nodes);
    return result;
  }
}
