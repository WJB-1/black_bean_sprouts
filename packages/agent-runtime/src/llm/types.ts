export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: LLMToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMStreamChunk {
  type: "content" | "tool_call" | "done";
  content?: string;
  toolCall?: Partial<LLMToolCall> & { index: number };
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  signal?: AbortSignal;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
  stream(messages: LLMMessage[], options?: LLMChatOptions): AsyncIterable<LLMStreamChunk>;
}
