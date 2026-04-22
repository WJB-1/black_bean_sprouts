import type { FastifyInstance } from "fastify";
import { loadEnv } from "../../env.js";
import { upsertByWechat } from "../../services/user.js";

const WECHAT_AUTH_URL = "https://open.weixin.qq.com/connect/qrconnect";

function normalizeRedirect(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return "/documents";
  }

  return input;
}

export default async function wechatRoutes(fastify: FastifyInstance) {
  fastify.get("/wechat", async (request, reply) => {
    const env = loadEnv();
    if (!env.WECHAT_APP_ID || !env.WECHAT_REDIRECT_URI) {
      return reply.status(501).send({
        error: { code: "NOT_CONFIGURED", message: "微信登录未配置" },
      });
    }

    const redirect = normalizeRedirect((request.query as Record<string, unknown>)["redirect"]);
    const params = new URLSearchParams({
      appid: env.WECHAT_APP_ID,
      redirect_uri: env.WECHAT_REDIRECT_URI,
      response_type: "code",
      scope: "snsapi_login",
      state: redirect,
    });

    await reply.redirect(`${WECHAT_AUTH_URL}?${params.toString()}`);
  });

  fastify.get("/wechat/callback", async (request, reply) => {
    const env = loadEnv();
    const query = request.query as Record<string, string>;
    const code = query["code"];
    const redirect = normalizeRedirect(query["state"]);

    if (!code) {
      return reply.status(400).send({
        error: { code: "MISSING_CODE", message: "缺少授权码" },
      });
    }

    if (!env.WECHAT_APP_SECRET) {
      return reply.status(501).send({
        error: { code: "NOT_CONFIGURED", message: "微信登录未配置" },
      });
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch(
        `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`,
      );
    } catch {
      return reply.status(502).send({
        error: { code: "WECHAT_API_ERROR", message: "微信服务不可用" },
      });
    }

    const tokenData = await tokenRes.json() as {
      openid?: string;
      access_token?: string;
    };

    if (!tokenData.openid) {
      return reply.status(502).send({
        error: { code: "WECHAT_ERROR", message: "微信授权失败" },
      });
    }

    let profileRes: Response;
    try {
      profileRes = await fetch(
        `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token ?? ""}&openid=${tokenData.openid}`,
      );
    } catch {
      return reply.status(502).send({
        error: { code: "WECHAT_API_ERROR", message: "获取用户信息失败" },
      });
    }

    const profileData = await profileRes.json() as {
      nickname?: string;
      headimgurl?: string;
      errcode?: number;
    };

    if (profileData.errcode) {
      return reply.status(502).send({
        error: { code: "WECHAT_ERROR", message: "获取用户信息失败" },
      });
    }

    const user = await upsertByWechat(
      tokenData.openid,
      profileData.nickname,
      profileData.headimgurl,
    );

    const payload = { userId: user.id, tier: user.tier };
    const accessToken = fastify.jwt.sign(payload);

    await reply.redirect(
      `/login?token=${encodeURIComponent(accessToken)}&redirect=${encodeURIComponent(redirect)}`,
    );
  });
}
