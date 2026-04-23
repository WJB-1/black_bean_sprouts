import { createFakeOpenClawKernel, createKernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
async function main() {
  console.log("smoke:agent-patch - Testing fake kernel...");
  const port = createFakeOpenClawKernel();
  const runtime = createKernelRuntime(port);
  const events: any[] = [];
  for await (const e of runtime.run({ message: "Add a section", documentId: "doc1" })) { events.push(e); }
  if (events.length === 0) { console.error("FAIL: no events"); process.exit(1); }
  const hasStart = events.some(e => e.stream === "lifecycle" && e.data.phase === "start");
  const hasEnd = events.some(e => e.stream === "lifecycle" && e.data.phase === "end");
  if (!hasStart || !hasEnd) { console.error("FAIL: missing lifecycle events"); process.exit(1); }
  console.log("PASS: fake kernel works, " + events.length + " events");
}
main().catch(e => { console.error(e); process.exit(1); });
