import type { FastifyInstance } from "fastify";
import smsRoutes from "./sms.js";
import wechatRoutes from "./wechat.js";
import meRoutes from "./me.js";

export default async function authRoutes(fastify: FastifyInstance) {
  await fastify.register(smsRoutes);
  await fastify.register(wechatRoutes);
  await fastify.register(meRoutes);
}
