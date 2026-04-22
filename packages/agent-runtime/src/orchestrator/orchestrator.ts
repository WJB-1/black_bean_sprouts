// @doc-schema-version: 1.0.0
import { nanoid } from "nanoid";
import type { LLMMessage, LLMToolCall } from "../llm/types.js";
import type { StreamEvent, ToolResult } from "../types.js";
import type { ToolCall } from "../observer.js";
import type { ToolContext } from "../tools/types.js";
import type { OrchestratorConfig, OrchestratorRunOptions } from "./types.js";

export class AgentOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  async *run(options: OrchestratorRunOptions): AsyncGenerator<StreamEvent> {
    const { provider, registry, skill, observer } = this.config;
    const messageId = nanoid();
    const ctx: ToolContext = {
      docId: options.docId,
      userId: options.userId,
      sessionId: options.sessionId,
      services: options.services,
    };

    if (observer) {
      await observer.onMessageStart({
        sessionId: options.sessionId,
        messageId,
        userId: options.userId,
        timestamp: Date.now(),
      });
    }

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
      tools: registry.list().map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      ...(options.signal !== undefined && { signal: options.signal }),
    };

    try {
      for (let turn = 0; turn < this.config.maxTurns; turn++) {
        const response = await provider.chat(messages, chatOptions);

        if (response.content) {
          yield { id: nanoid(), type: "message_delta", text: response.content };
        }

        if (!response.toolCalls || response.toolCalls.length === 0) {
          const usage = {
            inputTokens: response.usage?.inputTokens ?? 0,
            outputTokens: response.usage?.outputTokens ?? 0,
            model: "",
          };
          if (observer) {
            await observer.onMessageEnd({
              sessionId: options.sessionId,
              messageId,
              userId: options.userId,
              timestamp: Date.now(),
            }, usage);
          }
          yield { id: nanoid(), type: "done", usage };
          return;
        }

        messages.push({
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          const parsedArgs = parseToolArgs(toolCall);
          const observerCall: ToolCall = {
            id: toolCall.id,
            tool: toolCall.name,
            args: parsedArgs,
          };
          if (observer) {
            await observer.onToolCall({
              sessionId: options.sessionId,
              messageId,
              userId: options.userId,
              timestamp: Date.now(),
            }, observerCall);
          }

          yield {
            id: nanoid(),
            type: "tool_call_start",
            tool: toolCall.name,
            args: parsedArgs,
          };

          const result: ToolResult = await registry.execute(toolCall.name, parsedArgs, ctx);
          if (observer) {
            await observer.onToolResult({
              sessionId: options.sessionId,
              messageId,
              userId: options.userId,
              timestamp: Date.now(),
            }, observerCall, result);
          }

          yield { id: nanoid(), type: "tool_call_result", result };

          if (result.effects) {
            for (const effect of result.effects) {
              if (effect.type === "document_patch") {
                yield { id: nanoid(), type: "document_patched", patch: effect.patch };
              } else if (effect.type === "job_submitted") {
                yield { id: nanoid(), type: "job_submitted", jobId: effect.jobId };
              }
            }
          }

          messages.push({
            role: "tool",
            content: JSON.stringify(result.llmVisible),
            toolCallId: toolCall.id,
          });
        }
      }

      if (observer) {
        await observer.onMessageEnd({
          sessionId: options.sessionId,
          messageId,
          userId: options.userId,
          timestamp: Date.now(),
        }, { inputTokens: 0, outputTokens: 0, model: "" });
      }
      yield { id: nanoid(), type: "done", usage: { inputTokens: 0, outputTokens: 0, model: "" } };
    } catch (error) {
      if (observer && error instanceof Error) {
        await observer.onError({
          sessionId: options.sessionId,
          messageId,
          userId: options.userId,
          timestamp: Date.now(),
        }, error);
      }
      throw error;
    }
  }
}

function parseToolArgs(toolCall: LLMToolCall): Record<string, unknown> {
  try {
    return JSON.parse(toolCall.arguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}
