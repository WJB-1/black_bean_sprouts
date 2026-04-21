import type { FastifyInstance } from "fastify";
import { loadEnv } from "../../env.js";
import { upsertByWechat } from "../../services/user.js";

const WECHAT_AUTH_URL = "https://open.weixin.qq.com/connect/qrconnect";

export default async function wechatRoutes(fastify: FastifyInstance) {
  // Redirect to WeChat OAuth page
  fastify.get("/wechat", async (_request, reply) => {
    const env = loadEnv();
    if (!env.WECHAT_APP_ID || !env.WECHAT_REDIRECT_URI) {
      return reply.status(501).send({
        error: { code: "NOT_CONFIGURED", message: "微信登录未配置" },
      });
    }

    const params = new URLSearchParams({
      appid: env.WECHAT_APP_ID,
      redirect_uri: env.WECHAT_REDIRECT_URI,
      response_type: "code",
      scope: "snsapi_login",
    });

    await reply.redirect(`${WECHAT_AUTH_URL}?${params.toString()}`);
  });

  // WeChat OAuth callback
  fastify.get("/wechat/callback", async (request, reply) => {
    const env = loadEnv();
    const code = (request.query as Record<string, string>)["code"];

    if (!code) {
      return reply.status(400).send({
        error: { code: "MISSING_CODE", message: "缺少授权码" },
      });
    }

    // Exchange code for access_token + openid
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`,
    );
    const tokenData = await tokenRes.json() as {
      openid?: string;
      access_token?: string;
      errcode?: number;
    };

    if (!tokenData.openid) {
      return reply.status(502).send({
        error: { code: "WECHAT_ERROR", message: "微信授权失败" },
      });
    }

    // Fetch user profile from WeChat
    const profileRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`,
    );
    const profileData = await profileRes.json() as {
      nickname?: string;
      headimgurl?: string;
    };

    const user = await upsertByWechat(
      tokenData.openid,
      profileData.nickname,
      profileData.headimgurl,
    );

    const payload = { userId: user.id, tier: user.tier };
    const accessToken = fastify.jwt.sign(payload);

    // Redirect to frontend with token
    await reply.redirect(
      `/login?token=${accessToken}&userId=${user.id}`,
    );
  });
}
