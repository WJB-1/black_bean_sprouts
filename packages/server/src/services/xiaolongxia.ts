// @doc-schema-version: 1.0.0
import { LegacyAgentRuntimeAdapter } from "@black-bean-sprouts/xiaolongxia-kernel";
import { loadEnv } from "../env.js";

export function createXiaolongxiaRuntime(): LegacyAgentRuntimeAdapter {
  const env = loadEnv();
  const maxTurns = Number.parseInt(env.LLM_MAX_TURNS, 10) || 10;
  return new LegacyAgentRuntimeAdapter({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    maxTurns,
  });
}
