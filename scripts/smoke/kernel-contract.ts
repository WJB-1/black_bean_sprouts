import {
  createFakeOpenClawKernel,
  createKernelRuntime,
  createOpenClawAdapter,
} from "@black-bean-sprouts/xiaolongxia-kernel";

function summarize(events: any[]) {
  return events.map((event) => {
    if (event.stream === "tool") {
      return `${event.stream}:${String(event.data.phase)}:${String(event.data.toolName)}`;
    }
    return `${event.stream}:${String(event.data.phase ?? "")}`;
  });
}

async function collect(runtime: ReturnType<typeof createKernelRuntime>) {
  const events: any[] = [];
  for await (const event of runtime.run({
    message: "test",
    documentId: "doc-contract",
    sessionKey: "contract-session",
  })) {
    events.push(event);
  }
  return events;
}

async function main() {
  console.log("test:kernel-contract - Testing kernel contract...");
  const fake = createFakeOpenClawKernel({
    patchDocument: async () => true,
  });
  const real = createOpenClawAdapter({
    runner: async ({ message, sessionKey, documentId, onEvent }) => {
      const runId = "contract-run";
      onEvent({
        runId,
        seq: 0,
        stream: "lifecycle",
        sessionKey,
        data: { phase: "start", message: "adapter started" },
      });
      onEvent({
        runId,
        seq: 1,
        stream: "assistant",
        sessionKey,
        data: { phase: "delta", delta: "Processing..." },
      });
      if (documentId) {
        onEvent({
          runId,
          seq: 2,
          stream: "tool",
          sessionKey,
          data: { toolName: "patch_document", phase: "start", input: { documentId } },
        });
        onEvent({
          runId,
          seq: 3,
          stream: "tool",
          sessionKey,
          data: { toolName: "patch_document", phase: "end", output: { success: true } },
        });
      }
      onEvent({
        runId,
        seq: 4,
        stream: "assistant",
        sessionKey,
        data: { phase: "end", fullText: "Processed: " + message },
      });
      onEvent({
        runId,
        seq: 5,
        stream: "lifecycle",
        sessionKey,
        data: { phase: "end", message: "adapter completed" },
      });
    },
  });

  const fakeEvents = await collect(createKernelRuntime(fake));
  const realEvents = await collect(createKernelRuntime(real));
  const fakeSummary = summarize(fakeEvents);
  const realSummary = summarize(realEvents);

  if (fakeSummary.join("|") !== realSummary.join("|")) {
    console.error("FAIL: contract mismatch");
    console.error("fake:", fakeSummary.join(", "));
    console.error("real:", realSummary.join(", "));
    process.exit(1);
  }

  console.log("PASS: kernel contract satisfied, " + fakeEvents.length + " matched events");
}
main().catch(e => { console.error(e); process.exit(1); });
