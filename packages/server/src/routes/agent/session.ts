// @doc-schema-version: 1.0.0
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { prisma } from "../../lib/prisma.js";

const SessionIdParams = Type.Object({
  sessionId: Type.String({ minLength: 1 }),
});

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.get("/sessions", { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as { userId: string };
    return prisma.agentSession.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  });

  fastify.get("/sessions/:sessionId", {
    preHandler: [fastify.authenticate],
    schema: { params: SessionIdParams },
  }, async (request, reply) => {
    const user = request.user as { userId: string };
    const { sessionId } = request.params as { sessionId: string };
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!session || session.userId !== user.userId) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "会话不存在" },
      });
    }

    return session;
  });
}
