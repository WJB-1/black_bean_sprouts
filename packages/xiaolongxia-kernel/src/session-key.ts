// @doc-schema-version: 1.0.0
export type KernelSessionKeyParts = {
  agentId?: string;
  userId: string;
  documentId: string;
  sessionId: string;
};

const DEFAULT_AGENT_ID = "black-bean-sprouts";
const INVALID_CHARS_RE = /[^a-z0-9_-]+/gi;
const EDGE_DASH_RE = /^-+|-+$/g;

export function normalizeAgentId(value: string | undefined): string {
  return normalizeSegment(value, DEFAULT_AGENT_ID);
}

export function buildKernelSessionKey(parts: KernelSessionKeyParts): string {
  const agentId = normalizeAgentId(parts.agentId);
  const userId = normalizeSegment(parts.userId, "user");
  const documentId = normalizeSegment(parts.documentId, "document");
  const sessionId = normalizeSegment(parts.sessionId, "session");
  return `agent:${agentId}:web:direct:${userId}:doc:${documentId}:session:${sessionId}`;
}

function normalizeSegment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(INVALID_CHARS_RE, "-")
    .replace(EDGE_DASH_RE, "")
    .slice(0, 96);
  return normalized || fallback;
}
