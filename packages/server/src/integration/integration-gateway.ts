import type { OpenClawPort, KernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
import { createFakeOpenClawKernel, createKernelRuntime, createOpenClawAdapter, type OpenClawRawEvent } from "@black-bean-sprouts/xiaolongxia-kernel";

export type IntegrationGateway = { getKernelRuntime(): KernelRuntime };

export function createIntegrationGateway(): IntegrationGateway {
  const useReal = process.env.ENABLE_OPENCLAW_KERNEL === "true";
  let port: OpenClawPort;

  if (useReal) {
    // In production, the OpenClaw runner would be injected here
    // For now, create a placeholder that logs events
    port = createOpenClawAdapter({
      runner: async ({ message, onEvent }: { message: string; onEvent: (event: OpenClawRawEvent) => void }) => {
        const runId = "openclaw_" + Date.now();
        onEvent({ runId, stream: "lifecycle", data: { phase: "start" } });
        onEvent({ runId, stream: "assistant", data: { phase: "delta", delta: message } });
        onEvent({ runId, stream: "assistant", data: { phase: "end", fullText: `[OpenClaw] ${message}` } });
        onEvent({ runId, stream: "lifecycle", data: { phase: "end" } });
      },
    });
  } else {
    port = createFakeOpenClawKernel();
  }

  return { getKernelRuntime: () => createKernelRuntime(port) };
}
