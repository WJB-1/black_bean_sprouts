// @doc-schema-version: 1.0.0
export type KernelSessionEntry = {
  agentId: string;
  sessionId: string;
  sessionKey: string;
  userId: string;
  documentId: string;
  skillCode: string;
  skillsSnapshot: readonly string[];
  workingMemory: Record<string, unknown>;
};

export type KernelSessionInput = {
  agentId?: string;
  sessionId: string;
  userId: string;
  documentId: string;
  skillCode: string;
  skillsSnapshot: readonly string[];
  workingMemory: unknown;
};
