import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { sendCode, verifyCode } from "../../services/sms.js";
import { upsertByPhone } from "../../services/user.js";
import { badRequest } from "../../lib/errors.js";

const SendBody = Type.Object({
  phone: Type.String({ pattern: "^1[3-9]\\d{9}$" }),
});

const VerifyBody = Type.Object({
  phone: Type.String({ pattern: "^1[3-9]\\d{9}$" }),
  code: Type.String({ pattern: "^\\d{6}$" }),
});

export default async function smsRoutes(fastify: FastifyInstance) {
  fastify.post("/sms/send", {
    schema: { body: SendBody },
  }, async (request, reply) => {
    const { phone } = request.body as { phone: string };
    try {
      sendCode(phone);
      await reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err, phone }, "SMS send failed");
      // Still return success to prevent phone enumeration
      await reply.send({ success: true });
    }
  });

  fastify.post("/sms/verify", {
    schema: { body: VerifyBody },
  }, async (request, reply) => {
    const { phone, code } = request.body as { phone: string; code: string };

    if (!verifyCode(phone, code)) {
      throw badRequest("验证码错误或已过期");
    }

    const user = await upsertByPhone(phone);
    const payload = { userId: user.id, tier: user.tier };
    const accessToken = fastify.jwt.sign(payload);

    await reply.send({
      accessToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        tier: user.tier,
      },
    });
  });
}
