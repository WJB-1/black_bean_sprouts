// @doc-schema-version: 1.0.0
import { OpenAICompatProvider, type AgentObserver } from "@black-bean-sprouts/agent-runtime";
import { XiaolongxiaKernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
import { loadEnv } from "../env.js";
import { MockPatchLLMProvider } from "./mock-llm.js";

export function createXiaolongxiaRuntime(observer?: AgentObserver): XiaolongxiaKernelRuntime {
  const env = loadEnv();
  const maxTurns = Number.parseInt(env.LLM_MAX_TURNS, 10) || 10;
  return new XiaolongxiaKernelRuntime({
    provider: createProvider(),
    maxTurns,
    ...(observer !== undefined && { observer }),
  });
}

function createProvider() {
  const env = loadEnv();
  if (env.LLM_MODE === "mock") {
    return new MockPatchLLMProvider();
  }
  return new OpenAICompatProvider({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
  });
}
