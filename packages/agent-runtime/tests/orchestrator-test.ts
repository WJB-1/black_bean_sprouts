import { AgentOrchestrator } from "../src/orchestrator/orchestrator.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { thesisSkill } from "../src/skills/thesis.js";
import type { LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk } from "../src/llm/types.js";

// Mock LLMProvider that implements the LLMProvider interface
const mockProvider: LLMProvider = {
  async chat(messages: LLMMessage[], options?): Promise<LLMResponse> {
    return {
      content: "这是一个测试回复。",
      toolCalls: undefined,
      usage: { inputTokens: 10, outputTokens: 20 },
    };
  },
  async *stream(messages: LLMMessage[], options?): AsyncIterable<LLMStreamChunk> {
    yield { type: "content", content: "测试" };
  },
};

// Create test services
const mockServices = {
  prisma: null,
  loadDocument: async () => ({}),
  saveDocument: async () => {},
  submitRenderJob: async () => "job-1",
};

async function runTest() {
  console.log("=== Agent Runtime Orchestrator Test ===\n");

  // Step 1: Create ToolRegistry with no tools
  const registry = new ToolRegistry();
  console.log("✓ Created ToolRegistry");

  // Step 2: Create AgentOrchestrator with thesis skill
  const orchestrator = new AgentOrchestrator({
    provider: mockProvider,
    registry,
    skill: thesisSkill,
    maxTurns: 5,
  });
  console.log("✓ Created AgentOrchestrator");

  // Step 3: Run orchestrator and collect events
  const events = [];
  console.log("✓ Running orchestrator...");

  try {
    for await (const event of orchestrator.run({
      sessionId: "test-session",
      userId: "test-user",
      docId: "test-doc",
      userMessage: "你好",
      history: [],
      services: mockServices,
    })) {
      events.push(event);
      console.log(`  Event: ${event.type}`);
    }
  } catch (error) {
    console.error("✗ Error running orchestrator:", error);
    return false;
  }

  console.log(`\n✓ Collected ${events.length} events\n`);

  // Step 4: Verify expected events
  let pass = true;
  const failures = [];

  // Check 1: events.length > 0
  if (events.length > 0) {
    console.log("✓ PASS: events.length > 0");
  } else {
    console.log("✗ FAIL: events.length === 0");
    pass = false;
    failures.push("events.length === 0");
  }

  // Check 2: At least one event has type "message_delta"
  const hasMessageDelta = events.some((e) => e.type === "message_delta");
  if (hasMessageDelta) {
    console.log("✓ PASS: Found event with type 'message_delta'");
  } else {
    console.log("✗ FAIL: No event with type 'message_delta'");
    pass = false;
    failures.push("No message_delta event");
  }

  // Check 3: Last event has type "done"
  const lastEvent = events[events.length - 1];
  if (lastEvent && lastEvent.type === "done") {
    console.log("✓ PASS: Last event has type 'done'");
  } else {
    console.log(`✗ FAIL: Last event type is '${lastEvent?.type}', expected 'done'`);
    pass = false;
    failures.push("Last event not 'done'");
  }

  // Print all event types
  console.log("\n--- Event Types Collected ---");
  events.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.type}`);
  });

  // Final result
  console.log("\n=== Test Result ===");
  if (pass) {
    console.log("✅ PASS");
  } else {
    console.log("❌ FAIL");
    console.log(`Failures: ${failures.join(", ")}`);
  }

  return pass;
}

// Run the test
runTest()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test crashed:", error);
    process.exit(1);
  });
