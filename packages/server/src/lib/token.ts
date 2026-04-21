import type { FastifyInstance } from "fastify";
import type { AuthPayload } from "../plugins/auth.js";

export interface TokenPair {
  accessToken: string;
}

export async function signTokens(
  fastify: FastifyInstance,
  payload: AuthPayload,
): Promise<TokenPair> {
  const accessToken = fastify.jwt.sign(payload);
  return { accessToken };
}
