/** JSON Schema style parameter definition */
export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  properties?: Record<string, ParameterSchema>;
  items?: ParameterSchema;
  required?: string[];
  enum?: string[];
}

/** Context passed to every tool execution */
export interface ToolContext {
  docId: string;
  userId: string;
  sessionId: string;
  /** Services available to tools */
  services: ToolServices;
}

export interface ToolServices {
  prisma: unknown;
  loadDocument: (docId: string) => Promise<unknown>;
  saveDocument: (docId: string, content: unknown) => Promise<void>;
  submitRenderJob: (docId: string, format: string) => Promise<string>;
}

/** A tool that the agent can invoke */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<import("../types.js").ToolResult>;
}
