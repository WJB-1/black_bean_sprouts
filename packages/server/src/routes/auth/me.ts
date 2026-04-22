import type { FastifyInstance } from "fastify";
import { findById } from "../../services/user.js";

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get("/me", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user;
    try {
      const user = await findById(userId);
      return {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        tier: user.tier,
      };
    } catch {
      return reply.status(404).send({
        error: { code: "USER_NOT_FOUND", message: "用户不存在" },
      });
    }
  });
}
