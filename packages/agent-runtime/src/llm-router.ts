export interface LLMRouter {
  pick(req: {
    task: "chat" | "reasoning" | "extraction" | "long_context";
    skill: string;
    userTier: "free" | "pro" | "enterprise";
    estimatedInputTokens?: number;
    preferredModel?: string;
  }): ModelBinding;
}

export interface ModelBinding {
  primary: ModelSpec;
  fallbacks: ModelSpec[];
}

export interface ModelSpec {
  provider: string;
  model: string;
  maxTokens?: number;
}
