// @doc-schema-version: 1.0.0
export type KernelPersistedState = {
  agentId: string;
  sessionKey: string;
  skillsSnapshot: readonly string[];
  lastRunId?: string;
};

export function readKernelState(memory: unknown): KernelPersistedState | null {
  const kernel = isRecord(memory) ? memory["kernel"] : undefined;
  if (!isRecord(kernel)) {
    return null;
  }
  const agentId = readString(kernel["agentId"]);
  const sessionKey = readString(kernel["sessionKey"]);
  if (!agentId || !sessionKey) {
    return null;
  }
  const state: KernelPersistedState = {
    agentId,
    sessionKey,
    skillsSnapshot: readStringArray(kernel["skillsSnapshot"]),
  };
  const lastRunId = readString(kernel["lastRunId"]);
  if (lastRunId !== undefined) {
    state.lastRunId = lastRunId;
  }
  return state;
}

export function withKernelState(
  memory: unknown,
  state: KernelPersistedState,
): Record<string, unknown> {
  const base = isRecord(memory) ? { ...memory } : {};
  base["kernel"] = {
    agentId: state.agentId,
    sessionKey: state.sessionKey,
    skillsSnapshot: [...state.skillsSnapshot],
    ...(state.lastRunId !== undefined && { lastRunId: state.lastRunId }),
  };
  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
