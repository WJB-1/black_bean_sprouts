export type KernelEventStream =
  | "lifecycle"
  | "tool"
  | "assistant"
  | "error"
  | "item"
  | "plan"
  | "approval"
  | "command_output"
  | "patch"
  | "compaction"
  | "thinking";

export type KernelEvent = {
  readonly runId: string;
  readonly seq: number;
  readonly stream: KernelEventStream;
  readonly ts: number;
  readonly data: Record<string, unknown>;
  readonly sessionKey?: string;
};

export type KernelLifecyclePhase = "start" | "end" | "error";

export type KernelLifecycleEvent = KernelEvent & {
  stream: "lifecycle";
  data: { phase: KernelLifecyclePhase; message?: string; error?: string };
};

export type KernelToolEvent = KernelEvent & {
  stream: "tool";
  data: { toolName: string; phase: "start" | "end" | "error"; input?: unknown; output?: unknown; error?: string };
};

export type KernelPatchEvent = KernelEvent & {
  stream: "patch";
  data: { documentId: string; patches: readonly unknown[]; version: number };
};

export type KernelAssistantEvent = KernelEvent & {
  stream: "assistant";
  data: { delta?: string; fullText?: string; phase: "delta" | "end" };
};
