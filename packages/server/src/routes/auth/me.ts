import type { FastifyInstance } from "fastify";
import { findById } from "../../services/user.js";

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get("/me", {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { userId } = request.user;
    const user = await findById(userId);

    return {
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
    };
  });
}
