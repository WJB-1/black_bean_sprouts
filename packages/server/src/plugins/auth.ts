import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { loadEnv } from "../env.js";

export interface AuthPayload {
  userId: string;
  tier: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  const env = loadEnv();

  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest) {
      await request.jwtVerify();
    },
  );
});
