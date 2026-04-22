// @doc-schema-version: 1.0.0
import {
  AgentOrchestrator,
  getSkill,
  patchDocumentTool,
  queryDocumentTool,
  renderDocumentTool,
  ToolRegistry,
  type AgentObserver,
  type LLMProvider,
} from "@black-bean-sprouts/agent-runtime";
import type { KernelEvent } from "./event.js";
import type { KernelIngress, KernelRuntime } from "./ingress.js";

export type XiaolongxiaKernelConfig = {
  provider: LLMProvider;
  maxTurns: number;
  observer?: AgentObserver;
};

export class XiaolongxiaKernelRuntime implements KernelRuntime {
  private readonly config: XiaolongxiaKernelConfig;

  constructor(config: XiaolongxiaKernelConfig) {
    this.config = config;
  }

  async *run(ingress: KernelIngress): AsyncGenerator<KernelEvent> {
    const skill = getSkill(ingress.session.skillCode);
    if (!skill) {
      yield {
        id: `${ingress.runId}:invalid-skill`,
        type: "error",
        error: { code: "INVALID_SKILL", message: `未知技能：${ingress.session.skillCode}` },
      };
      yield doneEvent(ingress.runId);
      return;
    }

    yield {
      id: `${ingress.runId}:kernel-session`,
      type: "kernel_session",
      runId: ingress.runId,
      agentId: ingress.session.agentId,
      sessionKey: ingress.session.sessionKey,
      skillsSnapshot: ingress.session.skillsSnapshot,
    };
    yield {
      id: `${ingress.runId}:lifecycle:start`,
      type: "kernel_lifecycle",
      runId: ingress.runId,
      phase: "start",
      sessionKey: ingress.session.sessionKey,
    };

    try {
      const registry = new ToolRegistry();
      registry.register(patchDocumentTool);
      registry.register(queryDocumentTool);
      registry.register(renderDocumentTool);

      const orchestrator = new AgentOrchestrator({
        provider: this.config.provider,
        registry,
        skill,
        maxTurns: this.config.maxTurns,
        ...(this.config.observer !== undefined && { observer: this.config.observer }),
      });

      yield* orchestrator.run({
        sessionId: ingress.session.sessionId,
        userId: ingress.session.userId,
        docId: ingress.session.documentId,
        userMessage: ingress.userMessage,
        history: [...ingress.history],
        services: ingress.services,
        ...(ingress.signal !== undefined && { signal: ingress.signal }),
      });
      yield {
        id: `${ingress.runId}:lifecycle:end`,
        type: "kernel_lifecycle",
        runId: ingress.runId,
        phase: "end",
        sessionKey: ingress.session.sessionKey,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kernel run failed";
      yield {
        id: `${ingress.runId}:lifecycle:error`,
        type: "kernel_lifecycle",
        runId: ingress.runId,
        phase: "error",
        sessionKey: ingress.session.sessionKey,
        message,
      };
      yield {
        id: `${ingress.runId}:error`,
        type: "error",
        error: {
          code: "KERNEL_RUN_FAILED",
          message,
        },
      };
      yield doneEvent(ingress.runId);
    }
  }
}

function doneEvent(runId: string): KernelEvent {
  return {
    id: `${runId}:done`,
    type: "done",
    usage: { inputTokens: 0, outputTokens: 0, model: "" },
  };
}
