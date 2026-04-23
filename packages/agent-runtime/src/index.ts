export type ToolDefinition = {
  readonly name: string; readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export type ToolRegistry = {
  register(tool: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  list(): readonly ToolDefinition[];
};

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();
  return {
    register(tool) { tools.set(tool.name, tool); },
    get(name) { return tools.get(name); },
    list() { return Array.from(tools.values()); },
  };
}

export type LlmProvider = { readonly name: string; chat(messages: readonly { role: string; content: string }[]): Promise<string>; };

export type SkillDefinition = {
  readonly name: string; readonly description: string;
  readonly tools: readonly string[];
  readonly execute: (context: SkillContext) => Promise<string>;
};

export type SkillContext = { readonly toolRegistry: ToolRegistry; readonly documentId?: string; readonly sessionId?: string; };
