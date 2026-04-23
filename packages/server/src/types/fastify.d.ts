import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (req: any, reply: any) => Promise<void>;
    requireAdmin: (req: any, reply: any) => Promise<void>;
  }
}
