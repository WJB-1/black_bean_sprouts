export interface StreamOptions {
  signal?: AbortSignal;
  onToolCall?: (call: ToolCall) => Promise<boolean>;
  resumeFromEventId?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: unknown;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface ToolResult {
  llmVisible: {
    status: "success" | "error" | "pending";
    summary: string;
    data?: unknown;
  };
  effects?: ToolEffect[];
}

export type ToolEffect =
  | { type: "document_patch"; docId: string; patch: unknown }
  | { type: "asset_created"; assetId: string }
  | { type: "job_submitted"; jobId: string; waitStrategy: "block" | "detach" }
  | { type: "notification"; message: string };

export type StreamEvent =
  | { id: string; type: "message_delta"; text: string }
  | { id: string; type: "tool_call_start"; tool: string; args: unknown }
  | { id: string; type: "tool_call_result"; result: ToolResult }
  | { id: string; type: "tool_call_pending_approval"; call: ToolCall }
  | { id: string; type: "job_submitted"; jobId: string }
  | { id: string; type: "document_patched"; patch: unknown }
  | { id: string; type: "error"; error: ErrorInfo }
  | { id: string; type: "done"; usage: TokenUsage };
