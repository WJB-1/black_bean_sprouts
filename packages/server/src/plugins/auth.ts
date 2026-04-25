import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: "USER" | "ADMIN";
  iat?: number;
  exp?: number;
};

function getPayload(req: FastifyRequest): JwtPayload {
  return req.user as JwtPayload;
}

export async function authPlugin(app: FastifyInstance) {
  // requireAuth decorator
  app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Authentication required" });
    }
  });

  // requireAdmin decorator
  app.decorate("requireAdmin", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      if (getPayload(req).role !== "ADMIN") {
        return reply.status(403).send({ error: "Admin access required" });
      }
    } catch {
      return reply.status(401).send({ error: "Authentication required" });
    }
  });
}

export type AuthRouteDeps = {
  readonly prisma: PrismaClient;
};

export function createAuthRoutes(deps: AuthRouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/auth/login", async (req, reply) => {
      const { email, name } = req.body as { email?: string; name?: string };
      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return reply.status(400).send({ error: "email is required" });
      }

      const role: JwtPayload["role"] = normalizedEmail.includes("admin") ? "ADMIN" : "USER";
      const user = await deps.prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          role,
        },
        create: {
          email: normalizedEmail,
          ...(name?.trim() ? { name: name.trim() } : {}),
          role,
        },
      });

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    });
  };
}
