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

export type KernelEvent = StreamEvent | KernelSessionEvent;
