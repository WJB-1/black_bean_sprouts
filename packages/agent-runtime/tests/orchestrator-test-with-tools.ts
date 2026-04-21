import { AgentOrchestrator } from "../src/orchestrator/orchestrator.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { thesisSkill } from "../src/skills/thesis.js";
import type { LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk, LLMToolCall } from "../src/llm/types.js";
import type { ToolDefinition } from "../src/tools/types.js";

// Mock tool that returns a simple success
const mockQueryDocumentTool: ToolDefinition = {
  name: "query_document",
  description: "Query document content",
  parameters: {},
  execute: async (args, ctx) => {
    return {
      llmVisible: {
        status: "success",
        summary: "Document has 3 sections",
        data: { sections: ["Introduction", "Body", "Conclusion"] },
      },
    };
  },
};

// Mock LLMProvider that simulates a tool call flow
let callCount = 0;
const mockProviderWithToolCall: LLMProvider = {
  async chat(messages: LLMMessage[], options?): Promise<LLMResponse> {
    callCount++;

    // First call: return a tool call
    if (callCount === 1) {
      const toolCall: LLMToolCall = {
        id: "call_1",
        name: "query_document",
        arguments: "{}",
      };
      return {
        content: "Let me check the document structure.",
        toolCalls: [toolCall],
        usage: { inputTokens: 10, outputTokens: 20 },
      };
    }

    // Second call: after tool result, return final response
    return {
      content: "The document has 3 sections: Introduction, Body, and Conclusion.",
      toolCalls: undefined,
      usage: { inputTokens: 15, outputTokens: 25 },
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
  console.log("=== Agent Runtime Orchestrator Test (With Tool Calls) ===\n");

  // Reset call count
  callCount = 0;

  // Step 1: Create ToolRegistry with mock tool
  const registry = new ToolRegistry();
  registry.register(mockQueryDocumentTool);
  console.log("✓ Created ToolRegistry with query_document tool");

  // Step 2: Create AgentOrchestrator with thesis skill
  const orchestrator = new AgentOrchestrator({
    provider: mockProviderWithToolCall,
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
      userMessage: "Show me the document structure",
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

  // Check 2: Has message_delta events (should have 2 - one for each LLM response)
  const messageDeltaCount = events.filter((e) => e.type === "message_delta").length;
  if (messageDeltaCount >= 2) {
    console.log(`✓ PASS: Found ${messageDeltaCount} message_delta events`);
  } else {
    console.log(`✗ FAIL: Expected at least 2 message_delta events, got ${messageDeltaCount}`);
    pass = false;
    failures.push(`Expected 2 message_delta, got ${messageDeltaCount}`);
  }

  // Check 3: Has tool_call_start event
  const hasToolCallStart = events.some((e) => e.type === "tool_call_start");
  if (hasToolCallStart) {
    console.log("✓ PASS: Found tool_call_start event");
  } else {
    console.log("✗ FAIL: No tool_call_start event");
    pass = false;
    failures.push("No tool_call_start event");
  }

  // Check 4: Has tool_call_result event
  const hasToolCallResult = events.some((e) => e.type === "tool_call_result");
  if (hasToolCallResult) {
    console.log("✓ PASS: Found tool_call_result event");
  } else {
    console.log("✗ FAIL: No tool_call_result event");
    pass = false;
    failures.push("No tool_call_result event");
  }

  // Check 5: Last event has type "done"
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
