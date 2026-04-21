import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

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
