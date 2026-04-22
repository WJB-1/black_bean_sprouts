// @doc-schema-version: 1.0.0
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([
    Type.Literal("development"),
    Type.Literal("production"),
    Type.Literal("test"),
  ], { default: "development" }),
  PORT: Type.String({ default: "4000" }),
  DATABASE_URL: Type.String(),
  JWT_SECRET: Type.String(),
  JWT_EXPIRES_IN: Type.String({ default: "7d" }),
  WECHAT_APP_ID: Type.Optional(Type.String()),
  WECHAT_APP_SECRET: Type.Optional(Type.String()),
  WECHAT_REDIRECT_URI: Type.Optional(Type.String()),

  // LLM Provider (OpenAI-compatible API)
  LLM_MODE: Type.Union([
    Type.Literal("openai_compat"),
    Type.Literal("mock"),
  ], { default: "openai_compat" }),
  LLM_BASE_URL: Type.String({ default: "https://api.deepseek.com/v1" }),
  LLM_API_KEY: Type.String({ default: "" }),
  LLM_MODEL: Type.String({ default: "deepseek-chat" }),
  LLM_MAX_TURNS: Type.String({ default: "10" }),
});

export type Env = Static<typeof EnvSchema>;
import type { Static } from "@sinclair/typebox";

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;

  const env = Value.Cast(EnvSchema, process.env);
  if (!Value.Check(EnvSchema, env)) {
    const errors = [...Value.Errors(EnvSchema, env)];
    throw new Error(`Invalid env: ${errors.map((e) => e.message).join(", ")}`);
  }

  cached = env;
  return env;
}
