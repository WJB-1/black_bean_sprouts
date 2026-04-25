import { createIntegrationGateway } from "../../packages/server/src/integration/integration-gateway.js";
async function main() {
  console.log("smoke:agent-patch - Testing fake kernel fallback...");
  const previous = process.env.ENABLE_OPENCLAW_KERNEL;
  process.env.ENABLE_OPENCLAW_KERNEL = "false";
  const runtime = createIntegrationGateway().getKernelRuntime();
  const events: any[] = [];
  try {
    for await (const e of runtime.run({
      message: "Add a section",
      documentId: "doc1",
      sessionKey: "smoke-agent-patch",
    })) {
      events.push(e);
    }
  } finally {
    if (previous === undefined) {
      delete process.env.ENABLE_OPENCLAW_KERNEL;
    } else {
      process.env.ENABLE_OPENCLAW_KERNEL = previous;
    }
  }
  if (events.length === 0) { console.error("FAIL: no events"); process.exit(1); }
  const hasStart = events.some(e => e.stream === "lifecycle" && e.data.phase === "start");
  const hasEnd = events.some(e => e.stream === "lifecycle" && e.data.phase === "end");
  if (!hasStart || !hasEnd) { console.error("FAIL: missing lifecycle events"); process.exit(1); }
  console.log("PASS: fake kernel fallback works, " + events.length + " events");
}
main().catch(e => { console.error(e); process.exit(1); });
