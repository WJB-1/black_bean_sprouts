import type { OpenClawPort, OpenClawRunInput } from "./ports/openclaw-port.js";
import type { KernelEvent } from "./events/types.js";

export type KernelRuntime = {
  run(input: OpenClawRunInput): AsyncGenerator<KernelEvent>;
  resetSession(sessionKey: string): Promise<void>;
};

export function createKernelRuntime(port: OpenClawPort): KernelRuntime {
  return {
    async *run(input: OpenClawRunInput): AsyncGenerator<KernelEvent> { yield* port.run(input); },
    async resetSession(sessionKey: string): Promise<void> { await port.resetSession?.(sessionKey); },
  };
}
