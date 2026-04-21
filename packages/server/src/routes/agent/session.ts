import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../lib/errors.js";

const SessionIdParams = Type.Object({
  sessionId: Type.String({ pattern: "^[0-9a-fA-F]{24}$" }),
});

export default async function sessionRoutes(fastify: FastifyInstance) {
  // List sessions for current user
  fastify.get("/sessions", {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user as { userId: string };
    const sessions = await prisma.agentSession.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return sessions;
  });

  // Get session with messages
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
