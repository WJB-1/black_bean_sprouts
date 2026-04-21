import type { ToolDefinition } from "./types.js";
import type { ToolResult } from "../types.js";
import type { ToolContext } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        llmVisible: {
          status: "error",
          summary: `Unknown tool: ${name}`,
        },
      };
    }
    try {
      return await tool.execute(args, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool execution failed";
      return {
        llmVisible: { status: "error", summary: message },
      };
    }
  }

  /** Get tool definitions in LLM-consumable format */
  list(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    }));
  }
}
