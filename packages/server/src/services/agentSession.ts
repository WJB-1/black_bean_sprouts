// @doc-schema-version: 1.0.0
import type { Prisma } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export type AgentSessionLoadResult = {
  id: string;
  documentId: string;
  workingMemory: unknown;
  isNew: boolean;
};

export async function createOrLoadAgentSession(params: {
  userId: string;
  sessionId?: string;
  documentId?: string;
}): Promise<AgentSessionLoadResult> {
  if (params.sessionId) {
    const session = await prisma.agentSession.findUnique({ where: { id: params.sessionId } });
    if (!session || session.userId !== params.userId) {
      throw notFound("会话不存在");
    }
    return {
      id: session.id,
      documentId: session.documentId,
      workingMemory: session.workingMemory,
      isNew: false,
    };
  }

  if (!params.documentId) {
    throw badRequest("缺少 documentId");
  }

  const document = await prisma.document.findFirst({
    where: { id: params.documentId, userId: params.userId },
    select: { id: true },
  });
  if (!document) {
    throw notFound("文档不存在");
  }

  const session = await prisma.agentSession.create({
    data: { userId: params.userId, documentId: document.id, workingMemory: {} },
  });
  return {
    id: session.id,
    documentId: session.documentId,
    workingMemory: session.workingMemory,
    isNew: true,
  };
}

export async function updateAgentSessionWorkingMemory(
  sessionId: string,
  workingMemory: Record<string, unknown>,
): Promise<void> {
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { workingMemory: workingMemory as Prisma.InputJsonValue },
  });
}
