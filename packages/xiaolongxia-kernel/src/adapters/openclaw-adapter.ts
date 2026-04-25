import type { OpenClawPort, OpenClawRunInput } from "../ports/openclaw-port.js";
import type { KernelEvent } from "../events/types.js";
import type { OpenClawRawEvent } from "./event-mapper.js";
import { mapOpenClawEvent } from "./event-mapper.js";

/**
 * A function that runs an OpenClaw agent command and returns events.
 * This is the external interface that the real OpenClaw system must satisfy.
 */
export type OpenClawAgentRunner = (input: {
  message: string;
  sessionId?: string;
  sessionKey?: string;
  documentId?: string;
  abortSignal?: AbortSignal;
  onEvent: (event: OpenClawRawEvent) => void;
}) => Promise<void>;

export type OpenClawSessionReset = (sessionKey: string) => Promise<void>;

export type OpenClawAdapterConfig = {
  readonly runner: OpenClawAgentRunner;
  readonly resetSession?: OpenClawSessionReset;
};

export function createOpenClawAdapter(config: OpenClawAdapterConfig): OpenClawPort {
  return {
    async *run(input: OpenClawRunInput): AsyncGenerator<KernelEvent> {
      const events: KernelEvent[] = [];
      let resolveEvent: (() => void) | null = null;
      let done = false;
      let runnerError: unknown;
      let nextSeq = 0;

      const wakeConsumer = () => {
        if (resolveEvent) {
          resolveEvent();
          resolveEvent = null;
        }
      };

      const onEvent = (raw: OpenClawRawEvent) => {
        const mapped = mapOpenClawEvent(raw, nextSeq);
        nextSeq = mapped.seq + 1;
        events.push(mapped);
        wakeConsumer();
      };

      const runnerPromise = config
        .runner({
          message: input.message,
          sessionId: input.sessionId,
          sessionKey: input.sessionKey,
          documentId: input.documentId,
          abortSignal: input.abortSignal,
          onEvent,
        })
        .catch((error: unknown) => {
          runnerError = error;
        })
        .finally(() => {
          done = true;
          wakeConsumer();
        });

      let yieldIndex = 0;
      while (!done || yieldIndex < events.length) {
        if (yieldIndex < events.length) {
          const event = events[yieldIndex++];
          if (event) yield event;
        } else {
          await new Promise<void>((resolve) => {
            resolveEvent = resolve;
          });
        }
      }

      await runnerPromise;
      if (runnerError) {
        throw runnerError;
      }
    },

    async resetSession(sessionKey: string): Promise<void> {
      if (config.resetSession) {
        await config.resetSession(sessionKey);
      }
    },
  };
}
