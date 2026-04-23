import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

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

// Login route for testing/development
export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const { email } = req.body as { email: string };
    if (!email) return reply.status(400).send({ error: "email is required" });

    // In production: verify password, load user from DB
    // For now: generate token with role based on email
    const role = email.includes("admin") ? "ADMIN" : "USER";
    const token = app.jwt.sign({
      sub: "user_" + Date.now(),
      email,
      role,
    });
    return { token, user: { email, role } };
  });
}
