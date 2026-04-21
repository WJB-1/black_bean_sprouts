export interface MsgCtx {
  sessionId: string;
  messageId: string;
  userId: string;
  timestamp: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: unknown;
}

export interface ToolResult {
  llmVisible: {
    status: "success" | "error" | "pending";
    summary: string;
    data?: unknown;
  };
  effects?: unknown[];
}

export interface AgentObserver {
  onMessageStart(ctx: MsgCtx): Promise<void>;
  onToolCall(ctx: MsgCtx, call: ToolCall): Promise<void>;
  onToolResult(ctx: MsgCtx, call: ToolCall, result: ToolResult): Promise<void>;
  onMessageEnd(ctx: MsgCtx, usage: TokenUsage): Promise<void>;
  onError(ctx: MsgCtx, error: Error): Promise<void>;
}
