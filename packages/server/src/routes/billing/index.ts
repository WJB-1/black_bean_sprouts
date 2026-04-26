import type { FastifyPluginAsync } from "fastify";
import type {
  BillingApplicationService,
  BillingPublicProvider,
} from "../../services/billing-application.js";

export type BillingRouteDeps = {
  readonly billingService: BillingApplicationService;
};

type BillingCheckoutBody = {
  planId?: string;
  provider?: BillingPublicProvider;
  successUrl?: string;
  cancelUrl?: string;
};

type BillingConfirmBody = {
  orderId?: string;
  providerSessionId?: string;
};

export function createBillingRoutes(deps: BillingRouteDeps): FastifyPluginAsync {
  const { billingService } = deps;

  return async (app) => {
    if (app.hasContentTypeParser("application/json")) {
      app.removeContentTypeParser("application/json");
    }
    app.addContentTypeParser(
      "application/json",
      {
        parseAs: "string",
      },
      (_req, body, done) => done(null, body),
    );
    if (app.hasContentTypeParser("application/x-www-form-urlencoded")) {
      app.removeContentTypeParser("application/x-www-form-urlencoded");
    }
    app.addContentTypeParser(
      "application/x-www-form-urlencoded",
      {
        parseAs: "string",
      },
      (_req, body, done) => done(null, body),
    );

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

    app.post("/checkout", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const user = req.user as { sub: string; email?: string };
      const body = parseJsonBody<BillingCheckoutBody>(req.body);
      const planId = body.planId?.trim();
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
          provider: body.provider,
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
        });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Billing checkout failed",
        });
      }
    });

    app.post("/checkout/confirm", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Authentication required" });
      }
      const user = req.user as { sub: string };
      const body = parseJsonBody<BillingConfirmBody>(req.body);
      const orderId = body.orderId?.trim();
      if (!orderId) {
        return reply.status(400).send({ error: "orderId is required" });
      }

      try {
        return await billingService.confirmCheckout({
          userId: user.sub,
          orderId,
          providerSessionId: body.providerSessionId,
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

    app.post("/providers/alipay/notify", async (req, reply) => {
      const rawBody = getRawBody(req.body);
      const result = await billingService.handleNotification({
        provider: "alipay",
        headers: req.headers,
        rawBody,
      });
      reply.type(result.contentType);
      return reply.status(result.statusCode).send(result.body);
    });

    app.post("/providers/wechatpay/notify", async (req, reply) => {
      const rawBody = getRawBody(req.body);
      const result = await billingService.handleNotification({
        provider: "wechatpay",
        headers: req.headers,
        rawBody,
      });
      reply.type(result.contentType);
      return reply.status(result.statusCode).send(result.body);
    });
  };
}

function parseJsonBody<T>(body: unknown): T {
  if (typeof body !== "string") {
    return (body ?? {}) as T;
  }
  if (!body.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function getRawBody(body: unknown): string {
  if (typeof body === "string") {
    return body;
  }
  return JSON.stringify(body ?? {});
}
