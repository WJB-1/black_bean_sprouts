import type { LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk, LLMChatOptions, LLMToolCall } from "./types.js";

export interface OpenAICompatConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatProvider implements LLMProvider {
  private config: OpenAICompatConfig;

  constructor(config: OpenAICompatConfig) {
    this.config = config;
  }

  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const fetchInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? this.config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content ?? "",
          ...(m.toolCalls && { tool_calls: m.toolCalls }),
          ...(m.toolCallId && { tool_call_id: m.toolCallId }),
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        tools: options?.tools,
        stream: false,
      }),
    };
    if (options?.signal !== undefined) {
      fetchInit.signal = options.signal;
    }
    const res = await fetch(`${this.config.baseURL}/chat/completions`, fetchInit);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`LLM API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json() as OpenAIResponse;
    const choice = data.choices[0];
    const toolCalls = choice?.message?.tool_calls;
    const usage = data.usage;

    const response: LLMResponse = {
      content: choice?.message?.content ?? null,
    };
    if (toolCalls !== undefined && toolCalls.length > 0) {
      response.toolCalls = toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }
    if (usage !== undefined) {
      response.usage = { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
    }
    return response;
  }

  async *stream(messages: LLMMessage[], options?: LLMChatOptions): AsyncIterable<LLMStreamChunk> {
    const fetchInit: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? this.config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content ?? "",
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        tools: options?.tools,
        stream: true,
      }),
    };
    if (options?.signal !== undefined) {
      fetchInit.signal = options.signal;
    }
    const res = await fetch(`${this.config.baseURL}/chat/completions`, fetchInit);

    if (!res.ok) {
      throw new Error(`LLM stream error: ${res.status}`);
    }

    const body = res.body;
    if (!body) throw new Error("No response body");

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const chunk = JSON.parse(jsonStr) as StreamChunk;
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            yield { type: "content", content: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const toolCall: Partial<LLMToolCall> & { index: number } = {
                index: tc.index,
              };
              if (tc.id !== undefined) {
                toolCall.id = tc.id;
              }
              if (tc.function?.name !== undefined) {
                toolCall.name = tc.function.name;
              }
              if (tc.function?.arguments !== undefined) {
                toolCall.arguments = tc.function.arguments;
              }
              yield {
                type: "tool_call",
                toolCall,
              };
            }
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  }
}

// ── API Response Types ──

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}
