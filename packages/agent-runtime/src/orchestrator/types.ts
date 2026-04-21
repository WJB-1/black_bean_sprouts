import type { ToolServices } from "../tools/types.js";
import type { LLMMessage } from "../llm/types.js";

export interface OrchestratorConfig {
  provider: import("../llm/types.js").LLMProvider;
  registry: import("../tools/registry.js").ToolRegistry;
  observer?: import("../observer.js").AgentObserver;
  skill: import("../skills/types.js").SkillDefinition;
  maxTurns: number;
}

export interface OrchestratorRunOptions {
  sessionId: string;
  userId: string;
  docId: string;
  userMessage: string;
  history: LLMMessage[];
  signal?: AbortSignal;
  services: ToolServices;
}
