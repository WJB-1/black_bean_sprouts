import type { KernelEvent, KernelEventStream } from "../events/types.js";

export type OpenClawRawEvent = {
  runId: string; seq?: number; stream: string; ts?: number;
  data: Record<string, unknown>; sessionKey?: string;
};

const validStreams = new Set<KernelEventStream>([
  "lifecycle",
  "tool",
  "assistant",
  "error",
  "item",
  "plan",
  "approval",
  "command_output",
  "patch",
  "compaction",
  "thinking",
]);

export function mapOpenClawEvent(raw: OpenClawRawEvent, fallbackSeq = 0): KernelEvent {
  const stream: KernelEventStream = validStreams.has(raw.stream as KernelEventStream)
    ? (raw.stream as KernelEventStream)
    : "lifecycle";
  return {
    runId: raw.runId,
    seq: raw.seq ?? fallbackSeq,
    stream,
    ts: raw.ts ?? Date.now(),
    data: raw.data,
    sessionKey: raw.sessionKey,
  };
}
