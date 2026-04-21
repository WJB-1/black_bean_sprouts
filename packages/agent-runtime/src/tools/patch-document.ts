import type { ToolDefinition, ToolContext } from "./types.js";
import type { ToolResult } from "../types.js";

const parameterSchema = {
  type: "array" as const,
  description: "要执行的文档操作列表",
  items: {
    type: "object" as const,
    description: "单个文档操作",
    properties: {
      op: { type: "string" as const, description: "操作类型", enum: ["insert_block", "remove_block", "move_block", "update_text", "upsert_reference"] as string[] },
      parentId: { type: "string" as const, description: "父节点ID" },
      index: { type: "number" as const, description: "插入位置" },
      id: { type: "string" as const, description: "目标节点ID" },
      content: { type: "string" as const, description: "文本内容" },
    },
  },
} as const;

export const patchDocumentTool: ToolDefinition = {
  name: "patch_document",
  description: "修改文档内容。支持插入/删除/移动段落、添加章节、更新文本等操作。",
  parameters: {
    operations: parameterSchema,
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const operations = args["operations"] as Array<Record<string, unknown>> | undefined;
    if (!operations || !Array.isArray(operations)) {
      return { llmVisible: { status: "error", summary: "缺少 operations 参数" } };
    }

    const patches: unknown[] = [];
    for (const op of operations) {
      patches.push(op);
    }

    // Apply patches through services
    const doc = await ctx.services.loadDocument(ctx.docId) as Record<string, unknown>;
    // MVP: store the patched doc directly
    await ctx.services.saveDocument(ctx.docId, doc);

    return {
      llmVisible: {
        status: "success",
        summary: `已应用 ${patches.length} 个文档修改`,
        data: { count: patches.length },
      },
      effects: patches.map((p) => ({ type: "document_patch" as const, docId: ctx.docId, patch: p })),
    };
  },
};
