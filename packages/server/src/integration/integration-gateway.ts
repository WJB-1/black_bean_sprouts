import type { OpenClawPort, KernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
import {
  createFakeOpenClawKernel,
  createKernelRuntime,
  createOpenClawAdapter,
} from "@black-bean-sprouts/xiaolongxia-kernel";
import { createRealOpenClawAgentRunner } from "./openclaw-runtime.js";

export type IntegrationGateway = { getKernelRuntime(): KernelRuntime };

export function createIntegrationGateway(): IntegrationGateway {
  const useReal = process.env.ENABLE_OPENCLAW_KERNEL === "true";
  let port: OpenClawPort;

  if (useReal) {
    port = createOpenClawAdapter({
      runner: createRealOpenClawAgentRunner(),
    });
  } else {
    port = createFakeOpenClawKernel();
  }

  return { getKernelRuntime: () => createKernelRuntime(port) };
}
