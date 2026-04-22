// @doc-schema-version: 1.0.0
import type { StreamEvent } from "@black-bean-sprouts/agent-runtime";

export type KernelSessionEvent = {
  id: string;
  type: "kernel_session";
  runId: string;
  agentId: string;
  sessionKey: string;
  skillsSnapshot: readonly string[];
};

export type KernelLifecycleEvent = {
  id: string;
  type: "kernel_lifecycle";
  runId: string;
  phase: "start" | "end" | "error";
  sessionKey: string;
  message?: string;
};

export type KernelEvent = StreamEvent | KernelSessionEvent | KernelLifecycleEvent;
