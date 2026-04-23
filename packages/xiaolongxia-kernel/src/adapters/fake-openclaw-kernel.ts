import type { OpenClawPort, OpenClawRunInput } from "../ports/openclaw-port.js";
import type { KernelEvent } from "../events/types.js";

export type FakeKernelTools = {
  patchDocument?: (documentId: string, patches: unknown[]) => Promise<boolean>;
};

export function createFakeOpenClawKernel(tools?: FakeKernelTools): OpenClawPort {
  return {
    async *run(input: OpenClawRunInput): AsyncGenerator<KernelEvent> {
      const runId = "fake_" + Date.now();
      let seq = 0;
      yield { runId, seq: seq++, stream: "lifecycle", ts: Date.now(), data: { phase: "start", message: "Fake kernel started" } };
      yield { runId, seq: seq++, stream: "assistant", ts: Date.now(), data: { phase: "delta", delta: "Processing..." } };
      if (tools?.patchDocument && input.documentId) {
        yield { runId, seq: seq++, stream: "tool", ts: Date.now(), data: { toolName: "patch_document", phase: "start", input: { documentId: input.documentId } } };
        yield { runId, seq: seq++, stream: "tool", ts: Date.now(), data: { toolName: "patch_document", phase: "end", output: { success: true } } };
      }
      yield { runId, seq: seq++, stream: "assistant", ts: Date.now(), data: { phase: "end", fullText: "Processed: " + input.message } };
      yield { runId, seq, stream: "lifecycle", ts: Date.now(), data: { phase: "end", message: "Fake kernel completed" } };
    },
    async resetSession() {},
  };
}
