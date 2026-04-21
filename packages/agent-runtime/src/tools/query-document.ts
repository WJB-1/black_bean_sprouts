import type { ToolDefinition, ToolContext } from "./types.js";
import type { ToolResult } from "../types.js";

export const queryDocumentTool: ToolDefinition = {
  name: "query_document",
  description: "查询文档当前状态。返回文档结构概览或指定节点的详细内容。",
  parameters: {
    query: {
      type: "string",
      description: "查询内容: 'structure' 返回整体结构, 或指定节点ID返回详情",
    },
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const query = (args["query"] as string) ?? "structure";
    const doc = await ctx.services.loadDocument(ctx.docId) as Record<string, unknown> | null;

    if (!doc) {
      return { llmVisible: { status: "error", summary: "文档不存在" } };
    }

    if (query === "structure") {
      const content = doc["content"] as Array<Record<string, unknown>> | undefined;
      const summary = summarizeStructure(content ?? []);
      return {
        llmVisible: {
          status: "success",
          summary: "文档结构查询完成",
          data: { structure: summary },
        },
      };
    }

    return {
      llmVisible: {
        status: "success",
        summary: `查询: ${query}`,
        data: { document: doc },
      },
    };
  },
};

function summarizeStructure(nodes: Array<Record<string, unknown>>): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const attrs = node["attrs"] as Record<string, unknown> | undefined;
    if (node["type"] === "section") {
      const level = attrs?.["level"] as number | undefined;
      const title = attrs?.["title"] as string | undefined;
      lines.push(`${"  ".repeat((level ?? 1) - 1)}章节 L${level}: ${title}`);
      const content = node["content"] as Array<Record<string, unknown>> | undefined;
      if (content) {
        lines.push(...summarizeStructure(content));
      }
    } else {
      lines.push(`  - ${String(node["type"])}`);
    }
  }
  return lines;
}
