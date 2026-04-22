// @doc-schema-version: 1.0.0
import type { ToolServices } from "@black-bean-sprouts/agent-runtime";
import type { KernelEvent } from "./event.js";
import type { KernelSessionEntry } from "./session.js";

export type KernelHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type KernelIngress = {
  runId: string;
  session: KernelSessionEntry;
  userMessage: string;
  history: readonly KernelHistoryMessage[];
  services: ToolServices;
  signal?: AbortSignal;
};

export type KernelRuntime = {
  run(ingress: KernelIngress): AsyncGenerator<KernelEvent>;
};
