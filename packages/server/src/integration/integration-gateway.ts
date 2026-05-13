import type { OpenClawPort, KernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
import {
  createFakeOpenClawKernel,
  createKernelRuntime,
  createOpenClawAdapter,
} from "@black-bean-sprouts/xiaolongxia-kernel";
import { createClaudeCodeAgentRunner } from "./claude-code-runtime.js";
import { createRealOpenClawAgentRunner } from "./openclaw-runtime.js";

export type IntegrationGateway = { getKernelRuntime(): KernelRuntime };

export function createIntegrationGateway(): IntegrationGateway {
  const provider = resolveKernelProvider();
  let port: OpenClawPort;

  if (provider === "claude-code") {
    port = createOpenClawAdapter({
      runner: createClaudeCodeAgentRunner(),
    });
  } else if (provider === "openclaw") {
    port = createOpenClawAdapter({
      runner: createRealOpenClawAgentRunner(),
    });
  } else {
    port = createFakeOpenClawKernel();
  }

  return { getKernelRuntime: () => createKernelRuntime(port) };
}

function resolveKernelProvider(): "claude-code" | "openclaw" | "fake" {
  const explicit = process.env.AI_KERNEL_PROVIDER?.trim().toLowerCase();
  if (explicit === "claude-code" || explicit === "openclaw" || explicit === "fake") {
    return explicit;
  }
  if (process.env.ENABLE_CLAUDE_CODE_KERNEL === "true") {
    return "claude-code";
  }
  if (process.env.ENABLE_OPENCLAW_KERNEL === "true") {
    return "openclaw";
  }
  return "fake";
}
