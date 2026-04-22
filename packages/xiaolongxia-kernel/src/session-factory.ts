// @doc-schema-version: 1.0.0
import { buildKernelSessionKey, normalizeAgentId } from "./session-key.js";
import type { KernelSessionEntry, KernelSessionInput } from "./session.js";
import { readKernelState, withKernelState } from "./working-memory.js";

export function createKernelSessionEntry(input: KernelSessionInput): KernelSessionEntry {
  const persisted = readKernelState(input.workingMemory);
  const agentId = normalizeAgentId(input.agentId ?? persisted?.agentId);
  const sessionKey =
    persisted?.sessionKey ??
    buildKernelSessionKey({
      agentId,
      userId: input.userId,
      documentId: input.documentId,
      sessionId: input.sessionId,
    });
  const workingMemory = withKernelState(input.workingMemory, {
    agentId,
    sessionKey,
    skillsSnapshot: input.skillsSnapshot,
  });
  return {
    agentId,
    sessionId: input.sessionId,
    sessionKey,
    userId: input.userId,
    documentId: input.documentId,
    skillCode: input.skillCode,
    skillsSnapshot: input.skillsSnapshot,
    workingMemory,
  };
}
