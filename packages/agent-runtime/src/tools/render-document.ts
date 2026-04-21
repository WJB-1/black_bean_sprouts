import type { ToolDefinition, ToolContext } from "./types.js";
import type { ToolResult } from "../types.js";

export const renderDocumentTool: ToolDefinition = {
  name: "render_document",
  description: "渲染文档为 Word 文件。提交后台渲染任务并返回任务ID。",
  parameters: {
    format: {
      type: "string",
      description: "输出格式",
      enum: ["docx"],
    },
  },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const format = (args["format"] as string) ?? "docx";

    const jobId = await ctx.services.submitRenderJob(ctx.docId, format);

    return {
      llmVisible: {
        status: "pending",
        summary: `渲染任务已提交 (${format})`,
        data: { jobId, format },
      },
      effects: [
        { type: "job_submitted", jobId, waitStrategy: "detach" as const },
      ],
    };
  },
};
