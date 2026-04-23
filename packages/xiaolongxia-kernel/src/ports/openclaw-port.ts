import type { KernelEvent } from "../events/types.js";

export type OpenClawRunInput = {
  readonly message: string;
  readonly sessionId?: string;
  readonly sessionKey?: string;
  readonly documentId?: string;
  readonly abortSignal?: AbortSignal;
};

export type OpenClawPort = {
  run(input: OpenClawRunInput): AsyncGenerator<KernelEvent>;
  resetSession?(sessionKey: string): Promise<void>;
};
