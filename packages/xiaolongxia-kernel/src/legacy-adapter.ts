// @doc-schema-version: 1.0.0
import {
  AgentOrchestrator,
  getSkill,
  OpenAICompatProvider,
  patchDocumentTool,
  queryDocumentTool,
  renderDocumentTool,
  ToolRegistry,
} from "@black-bean-sprouts/agent-runtime";
import type { KernelEvent } from "./event.js";
import type { KernelIngress, KernelRuntime } from "./ingress.js";
import { createSkillsSnapshot } from "./skills-snapshot.js";

export type LegacyAdapterConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTurns: number;
};

export class LegacyAgentRuntimeAdapter implements KernelRuntime {
  private readonly config: LegacyAdapterConfig;

  constructor(config: LegacyAdapterConfig) {
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

    const provider = new OpenAICompatProvider(this.config);
    const registry = new ToolRegistry();
    registry.register(patchDocumentTool);
    registry.register(queryDocumentTool);
    registry.register(renderDocumentTool);

    const orchestrator = new AgentOrchestrator({
      provider,
      registry,
      skill,
      maxTurns: this.config.maxTurns,
    });
    const options = {
      sessionId: ingress.session.sessionId,
      userId: ingress.session.userId,
      docId: ingress.session.documentId,
      userMessage: ingress.userMessage,
      history: [...ingress.history],
      services: ingress.services,
      ...(ingress.signal !== undefined && { signal: ingress.signal }),
    };
    yield* orchestrator.run(options);
  }
}

export function resolveLegacySkillsSnapshot(skillCode: string): readonly string[] | null {
  const skill = getSkill(skillCode);
  return skill ? createSkillsSnapshot({ skillCode: skill.code, tools: skill.tools }) : null;
}

function doneEvent(runId: string): KernelEvent {
  return {
    id: `${runId}:done`,
    type: "done",
    usage: { inputTokens: 0, outputTokens: 0, model: "" },
  };
}
