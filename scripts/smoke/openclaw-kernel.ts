import { createFakeOpenClawKernel, createKernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";

async function main() {
  console.log("smoke:openclaw-kernel - Testing OpenClaw kernel adapter...");
  const port = createFakeOpenClawKernel();
  const runtime = createKernelRuntime(port);

  const events: any[] = [];
  for await (const e of runtime.run({ message: "Test message" })) {
    events.push(e);
  }

  if (events.length === 0) {
    console.error("FAIL: no events from kernel");
    process.exit(1);
  }

  // Check lifecycle events
  const phases = events.filter(e => e.stream === "lifecycle").map(e => e.data.phase);
  if (!phases.includes("start") || !phases.includes("end")) {
    console.error("FAIL: missing lifecycle phases, got: " + phases.join(","));
    process.exit(1);
  }

  // Check assistant events
  const assistantEvents = events.filter(e => e.stream === "assistant");
  if (assistantEvents.length === 0) {
    console.error("FAIL: no assistant events");
    process.exit(1);
  }

  console.log("PASS: OpenClaw kernel adapter works, " + events.length + " events (" +
    phases.length + " lifecycle, " + assistantEvents.length + " assistant)");
}
main().catch(e => { console.error(e); process.exit(1); });
