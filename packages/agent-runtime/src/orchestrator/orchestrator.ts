import { nanoid } from "nanoid";
import type { LLMMessage, LLMToolCall } from "../llm/types.js";
import type { StreamEvent, ToolResult } from "../types.js";
import type { ToolContext } from "../tools/types.js";
import type { OrchestratorConfig, OrchestratorRunOptions } from "./types.js";

export class AgentOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  async *run(options: OrchestratorRunOptions): AsyncGenerator<StreamEvent> {
    const { provider, registry, skill, observer } = this.config;
    const ctx: ToolContext = {
      docId: options.docId,
      userId: options.userId,
      sessionId: options.sessionId,
      services: options.services,
    };

    const messages: LLMMessage[] = [
      { role: "system", content: skill.systemPrompt },
      ...options.history,
      { role: "user", content: options.userMessage },
    ];

    const chatOptions: {
      tools: Array<{
        type: "function";
        function: { name: string; description: string; parameters: Record<string, unknown> };
      }>;
      signal?: AbortSignal;
    } = {
      tools: registry.list().map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    };

    if (options.signal !== undefined) {
      chatOptions.signal = options.signal;
    }

    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      // Call LLM
      const response = await provider.chat(messages, chatOptions);

      if (observer) {
        await observer.onMessageEnd(
          { sessionId: options.sessionId, messageId: nanoid(), userId: options.userId, timestamp: Date.now() },
          { inputTokens: response.usage?.inputTokens ?? 0, outputTokens: response.usage?.outputTokens ?? 0, model: "" },
        );
      }

      // Yield content delta
      if (response.content) {
        yield { id: nanoid(), type: "message_delta", text: response.content };
      }

      // No tool calls -> done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        yield {
          id: nanoid(),
          type: "done",
          usage: {
            inputTokens: response.usage?.inputTokens ?? 0,
            outputTokens: response.usage?.outputTokens ?? 0,
            model: "",
          },
        };
        return;
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        yield { id: nanoid(), type: "tool_call_start", tool: toolCall.name, args: undefined };

        const args = parseToolArgs(toolCall);
        const result: ToolResult = await registry.execute(toolCall.name, args, ctx);

        yield { id: nanoid(), type: "tool_call_result", result };

        // Yield effects
        if (result.effects) {
          for (const effect of result.effects) {
            if (effect.type === "document_patch") {
              yield { id: nanoid(), type: "document_patched", patch: effect.patch };
            } else if (effect.type === "job_submitted") {
              yield { id: nanoid(), type: "job_submitted", jobId: effect.jobId };
            }
          }
        }

        // Feed result back to LLM
        messages.push({
          role: "tool",
          content: JSON.stringify(result.llmVisible),
          toolCallId: toolCall.id,
        });
      }
    }

    yield { id: nanoid(), type: "done", usage: { inputTokens: 0, outputTokens: 0, model: "" } };
  }
}

function parseToolArgs(toolCall: LLMToolCall): Record<string, unknown> {
  try {
    return JSON.parse(toolCall.arguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}
