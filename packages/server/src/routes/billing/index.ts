import type { FastifyPluginAsync } from "fastify";
import type { BillingApplicationService } from "../../services/billing-application.js";

export type BillingRouteDeps = {
  readonly billingService: BillingApplicationService;
};

export function createBillingRoutes(deps: BillingRouteDeps): FastifyPluginAsync {
  const { billingService } = deps;

  return async (app) => {
    app.get("/plans", async () => billingService.listPlans());

    app.get("/me", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const user = req.user as { sub: string };
      return billingService.getUserSummary(user.sub);
    });

    app.post<{
      Body: {
        planId?: string;
        successUrl?: string;
        cancelUrl?: string;
      };
    }>("/checkout", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const user = req.user as { sub: string; email?: string };
      const planId = req.body?.planId?.trim();
      if (!planId) {
        return reply.status(400).send({ error: "planId is required" });
      }
      if (!user.sub || !user.email) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      try {
        return await billingService.createCheckout({
          userId: user.sub,
          email: user.email,
          planId,
          successUrl: req.body?.successUrl,
          cancelUrl: req.body?.cancelUrl,
        });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Billing checkout failed",
        });
      }
    });

    app.post<{
      Body: {
        orderId?: string;
        providerSessionId?: string;
      };
    }>("/checkout/confirm", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const user = req.user as { sub: string };
      const orderId = req.body?.orderId?.trim();
      if (!orderId) {
        return reply.status(400).send({ error: "orderId is required" });
      }

      try {
        return await billingService.confirmCheckout({
          userId: user.sub,
          orderId,
          providerSessionId: req.body?.providerSessionId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Billing confirmation failed";
        if (message.startsWith("Forbidden")) {
          return reply.status(403).send({ error: message });
        }
        if (message.includes("not found")) {
          return reply.status(404).send({ error: message });
        }
        return reply.status(400).send({ error: message });
      }
    });
  };
}
