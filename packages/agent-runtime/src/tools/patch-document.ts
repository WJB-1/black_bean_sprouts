import { isValidDocumentPatchArray, type DocumentPatch } from "@black-bean-sprouts/doc-schema";
import type { ToolResult } from "../types.js";
import type { ParameterSchema, ToolDefinition, ToolContext } from "./types.js";

const patchArraySchema: ParameterSchema = {
  type: "array",
  description: "要应用到当前文档的 DocumentPatch[]",
  items: {
    type: "object",
    description: "单个 DocumentPatch",
    properties: {
      op: { type: "string", description: "Patch 操作类型" },
    },
    required: ["op"],
  },
};

export const patchDocumentTool: ToolDefinition = {
  name: "patch_document",
  description: "应用 DocumentPatch[] 修改当前文档内容。",
  parameters: {
    patches: patchArraySchema,
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    if (!ctx.docId) {
      return {
        llmVisible: {
          status: "error",
          summary: "当前会话没有 documentId，无法应用 patch",
        },
      };
    }

    const patches = resolvePatchArray(args);
    if (!patches) {
      return {
        llmVisible: {
          status: "error",
          summary: "缺少 patches 参数，或参数不是合法的 patch 数组",
        },
      };
    }

    await ctx.services.applyDocumentPatches(ctx.docId, patches);

    return {
      llmVisible: {
        status: "success",
        summary: `已应用 ${patches.length} 个文档 patch`,
        data: { count: patches.length },
      },
      effects: patches.map((patch) => ({
        type: "document_patch" as const,
        docId: ctx.docId,
        patch,
      })),
    };
  },
};

function resolvePatchArray(args: Record<string, unknown>): DocumentPatch[] | null {
  const directPatches = args["patches"];
  if (isValidDocumentPatchArray(directPatches)) {
    return directPatches;
  }

  const legacyOperations = args["operations"];
  if (isValidDocumentPatchArray(legacyOperations)) {
    return legacyOperations;
  }

  return null;
}
