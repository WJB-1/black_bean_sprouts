import type { KernelEvent, KernelEventStream } from "../events/types.js";

export type OpenClawRawEvent = {
  runId: string; seq?: number; stream: string; ts?: number;
  data: Record<string, unknown>; sessionKey?: string;
};

let mappedSeq = 0;

export function mapOpenClawEvent(raw: OpenClawRawEvent): KernelEvent {
  const validStreams: KernelEventStream[] = ["lifecycle", "tool", "assistant", "error", "patch", "thinking"];
  const stream: KernelEventStream = validStreams.includes(raw.stream as KernelEventStream) ? (raw.stream as KernelEventStream) : "lifecycle";
  return { runId: raw.runId, seq: raw.seq ?? mappedSeq++, stream, ts: raw.ts ?? Date.now(), data: raw.data, sessionKey: raw.sessionKey };
}
