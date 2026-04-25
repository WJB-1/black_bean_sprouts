import { randomUUID, createHash } from "node:crypto";
import {
  BillingOrderStatus,
  BillingProvider,
  SubscriptionStatus,
  type PrismaClient,
} from "@prisma/client";

export type BillingPlanInterval = "month" | "year";

export type BillingPlan = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly interval?: BillingPlanInterval;
  readonly accessDays: number;
  readonly features: readonly string[];
};

export type BillingPlanSummary = BillingPlan & {
  readonly provider: "mock" | "stripe";
};

export type BillingCheckoutResult = {
  readonly orderId: string;
  readonly provider: "mock" | "stripe";
  readonly checkoutUrl: string;
  readonly providerSessionId?: string;
  readonly status: "PENDING" | "PAID";
};

export type BillingUserSummary = {
  readonly plans: readonly BillingPlanSummary[];
  readonly subscriptions: ReadonlyArray<{
    readonly id: string;
    readonly planId: string;
    readonly planName: string;
    readonly status: string;
    readonly currentPeriodEnd?: string;
    readonly provider: string;
  }>;
  readonly recentOrders: ReadonlyArray<{
    readonly id: string;
    readonly planId: string;
    readonly planName: string;
    readonly amountCents: number;
    readonly currency: string;
    readonly status: string;
    readonly provider: string;
    readonly createdAt: string;
    readonly paidAt?: string;
  }>;
};

export type BillingApplicationService = {
  listPlans(): Promise<readonly BillingPlanSummary[]>;
  getUserSummary(userId: string): Promise<BillingUserSummary>;
  createCheckout(params: {
    userId: string;
    email: string;
    planId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<BillingCheckoutResult>;
  confirmCheckout(params: {
    userId: string;
    orderId: string;
    providerSessionId?: string;
  }): Promise<{
    readonly orderId: string;
    readonly status: string;
    readonly subscriptionStatus?: string;
  }>;
};

export type BillingApplicationDeps = {
  readonly prisma: PrismaClient;
};

type StripeCheckoutSession = {
  id: string;
  url?: string;
  status?: string;
  payment_status?: string;
  subscription?: string;
};

const DEFAULT_BILLING_PLANS: readonly BillingPlan[] = Object.freeze([
  {
    id: "starter-monthly",
    name: "Starter Monthly",
    description: "Structured generation + DOCX/LaTeX export",
    amountCents: 990,
    currency: "usd",
    interval: "month",
    accessDays: 30,
    features: ["workbench.generate", "workbench.export.docx", "workbench.export.latex"],
  },
  {
    id: "starter-yearly",
    name: "Starter Yearly",
    description: "Structured generation + DOCX/LaTeX export",
    amountCents: 9990,
    currency: "usd",
    interval: "year",
    accessDays: 365,
    features: ["workbench.generate", "workbench.export.docx", "workbench.export.latex"],
  },
]);

export function createBillingApplicationService(
  deps: BillingApplicationDeps,
): BillingApplicationService {
  const { prisma } = deps;
  const listPlanSummaries = async (): Promise<readonly BillingPlanSummary[]> => {
    const provider = resolveBillingProvider();
    return getBillingPlans().map((plan) => ({
      ...plan,
      provider,
    }));
  };

  return {
    async listPlans() {
      return listPlanSummaries();
    },

    async getUserSummary(userId) {
      const [subscriptions, orders] = await Promise.all([
        prisma.userSubscription.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.billingOrder.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

      return {
        plans: await listPlanSummaries(),
        subscriptions: subscriptions.map((item) => ({
          id: item.id,
          planId: item.planId,
          planName: item.planName,
          status: item.status,
          currentPeriodEnd: item.currentPeriodEnd?.toISOString(),
          provider: item.provider,
        })),
        recentOrders: orders.map((item) => ({
          id: item.id,
          planId: item.planId,
          planName: item.planName,
          amountCents: item.amountCents,
          currency: item.currency,
          status: item.status,
          provider: item.provider,
          createdAt: item.createdAt.toISOString(),
          paidAt: item.paidAt?.toISOString(),
        })),
      };
    },

    async createCheckout(params) {
      const plan = requireBillingPlan(params.planId);
      const provider = resolveBillingProvider();

      if (provider === "mock") {
        const order = await prisma.billingOrder.create({
          data: {
            userId: params.userId,
            planId: plan.id,
            planName: plan.name,
            amountCents: plan.amountCents,
            currency: plan.currency,
            provider: BillingProvider.MOCK,
            status: BillingOrderStatus.PAID,
            checkoutUrl: buildMockCheckoutUrl(params.planId),
            paidAt: new Date(),
            metadata: {
              mode: "mock",
            },
          },
        });
        await activateSubscriptionForOrder(prisma, order.id, plan);
        return {
          orderId: order.id,
          provider: "mock",
          checkoutUrl: order.checkoutUrl ?? buildMockCheckoutUrl(params.planId),
          status: "PAID",
        };
      }

      const order = await prisma.billingOrder.create({
        data: {
          userId: params.userId,
          planId: plan.id,
          planName: plan.name,
          amountCents: plan.amountCents,
          currency: plan.currency,
          provider: BillingProvider.STRIPE,
          status: BillingOrderStatus.PENDING,
          metadata: {
            requestedSuccessUrl: params.successUrl,
            requestedCancelUrl: params.cancelUrl,
          },
        },
      });

      try {
        const stripeSession = await createStripeCheckoutSession({
          orderId: order.id,
          email: params.email,
          plan,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
        });

        const updatedOrder = await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            providerSessionId: stripeSession.id,
            checkoutUrl: stripeSession.url,
            metadata: {
              sessionId: stripeSession.id,
              mode: "stripe",
            },
          },
        });

        return {
          orderId: updatedOrder.id,
          provider: "stripe",
          checkoutUrl:
            updatedOrder.checkoutUrl ??
            `${resolveAppBaseUrl()}/billing/error?orderId=${encodeURIComponent(updatedOrder.id)}`,
          providerSessionId: updatedOrder.providerSessionId ?? undefined,
          status: "PENDING",
        };
      } catch (error) {
        await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            status: BillingOrderStatus.FAILED,
            metadata: {
              mode: "stripe",
              error: error instanceof Error ? error.message : String(error),
            },
          },
        });
        throw error;
      }
    },

    async confirmCheckout(params) {
      const order = await prisma.billingOrder.findUnique({
        where: { id: params.orderId },
      });
      if (!order) {
        throw new Error("Billing order not found.");
      }
      if (order.userId !== params.userId) {
        throw new Error("Forbidden: you do not own this billing order.");
      }
      if (order.status === BillingOrderStatus.PAID) {
        const existingSubscription = await prisma.userSubscription.findFirst({
          where: { sourceOrderId: order.id },
          orderBy: { createdAt: "desc" },
        });
        return {
          orderId: order.id,
          status: order.status,
          subscriptionStatus: existingSubscription?.status,
        };
      }

      if (order.provider === BillingProvider.MOCK) {
        const plan = requireBillingPlan(order.planId);
        await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            status: BillingOrderStatus.PAID,
            paidAt: new Date(),
          },
        });
        const subscription = await activateSubscriptionForOrder(prisma, order.id, plan);
        return {
          orderId: order.id,
          status: BillingOrderStatus.PAID,
          subscriptionStatus: subscription.status,
        };
      }

      const providerSessionId = params.providerSessionId ?? order.providerSessionId;
      if (!providerSessionId) {
        throw new Error("providerSessionId is required to confirm a Stripe checkout.");
      }

      const session = await retrieveStripeCheckoutSession(providerSessionId);
      if (!isStripeSessionPaid(session)) {
        return {
          orderId: order.id,
          status: order.status,
        };
      }

      const plan = requireBillingPlan(order.planId);
      await prisma.billingOrder.update({
        where: { id: order.id },
        data: {
          status: BillingOrderStatus.PAID,
          paidAt: new Date(),
          providerSessionId: session.id,
          providerSubscriptionId: session.subscription ?? undefined,
          metadata: {
            mode: "stripe",
            confirmedAt: new Date().toISOString(),
            stripeStatus: session.status,
            stripePaymentStatus: session.payment_status,
          },
        },
      });

      const subscription = await activateSubscriptionForOrder(prisma, order.id, plan, {
        providerSubscriptionId: session.subscription ?? undefined,
      });
      return {
        orderId: order.id,
        status: BillingOrderStatus.PAID,
        subscriptionStatus: subscription.status,
      };
    },
  };
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveBillingProvider(): "mock" | "stripe" {
  const configured = normalizeOptionalString(process.env.BILLING_PROVIDER)?.toLowerCase();
  if (configured === "stripe" && normalizeOptionalString(process.env.STRIPE_SECRET_KEY)) {
    return "stripe";
  }
  return "mock";
}

function resolveAppBaseUrl(): string {
  return normalizeOptionalString(process.env.APP_BASE_URL) ?? "http://localhost:3000";
}

function getBillingPlans(): readonly BillingPlan[] {
  const raw = normalizeOptionalString(process.env.BILLING_PLANS_JSON);
  if (!raw) {
    return DEFAULT_BILLING_PLANS;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_BILLING_PLANS;
    }
    const plans = parsed
      .map((item) => normalizeBillingPlan(item))
      .filter((item): item is BillingPlan => Boolean(item));
    return plans.length > 0 ? plans : DEFAULT_BILLING_PLANS;
  } catch {
    return DEFAULT_BILLING_PLANS;
  }
}

function normalizeBillingPlan(value: unknown): BillingPlan | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const amountCents = typeof record.amountCents === "number" ? record.amountCents : Number(record.amountCents);
  const currency = typeof record.currency === "string" ? record.currency.trim().toLowerCase() : "";
  const interval =
    record.interval === "month" || record.interval === "year"
      ? record.interval
      : undefined;
  const accessDays = typeof record.accessDays === "number" ? record.accessDays : Number(record.accessDays);
  const features = Array.isArray(record.features)
    ? record.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (!id || !name || !Number.isFinite(amountCents) || amountCents <= 0 || !currency || !Number.isFinite(accessDays) || accessDays <= 0) {
    return undefined;
  }

  return {
    id,
    name,
    description: typeof record.description === "string" ? record.description.trim() : undefined,
    amountCents: Math.round(amountCents),
    currency,
    interval,
    accessDays: Math.round(accessDays),
    features,
  };
}

function requireBillingPlan(planId: string): BillingPlan {
  const plan = getBillingPlans().find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown billing plan: ${planId}`);
  }
  return plan;
}

function buildMockCheckoutUrl(planId: string): string {
  const token = createHash("sha256").update(`${planId}:${randomUUID()}`).digest("hex").slice(0, 16);
  return `${resolveAppBaseUrl()}/billing/mock-success?token=${token}`;
}

async function activateSubscriptionForOrder(
  prisma: PrismaClient,
  orderId: string,
  plan: BillingPlan,
  options: {
    providerSubscriptionId?: string;
  } = {},
) {
  const order = await prisma.billingOrder.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    throw new Error("Billing order not found during subscription activation.");
  }

  await prisma.userSubscription.updateMany({
    where: {
      userId: order.userId,
      status: SubscriptionStatus.ACTIVE,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    },
  });

  return prisma.userSubscription.create({
    data: {
      userId: order.userId,
      planId: plan.id,
      planName: plan.name,
      provider: order.provider,
      status: SubscriptionStatus.ACTIVE,
      sourceOrderId: order.id,
      providerSubscriptionId: options.providerSubscriptionId,
      currentPeriodEnd: new Date(Date.now() + plan.accessDays * 24 * 60 * 60 * 1000),
    },
  });
}

async function createStripeCheckoutSession(params: {
  orderId: string;
  email: string;
  plan: BillingPlan;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<StripeCheckoutSession> {
  const secretKey = normalizeOptionalString(process.env.STRIPE_SECRET_KEY);
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe billing.");
  }

  const successUrl =
    normalizeOptionalString(params.successUrl) ??
    normalizeOptionalString(process.env.BILLING_SUCCESS_URL) ??
    `${resolveAppBaseUrl()}/billing/success?orderId=${encodeURIComponent(params.orderId)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    normalizeOptionalString(params.cancelUrl) ??
    normalizeOptionalString(process.env.BILLING_CANCEL_URL) ??
    `${resolveAppBaseUrl()}/billing/cancel?orderId=${encodeURIComponent(params.orderId)}`;

  const form = new URLSearchParams();
  form.set("mode", params.plan.interval ? "subscription" : "payment");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("client_reference_id", params.orderId);
  form.set("customer_email", params.email);
  form.set("allow_promotion_codes", "true");
  form.set("metadata[orderId]", params.orderId);
  form.set("metadata[planId]", params.plan.id);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", params.plan.currency);
  form.set("line_items[0][price_data][unit_amount]", String(params.plan.amountCents));
  form.set("line_items[0][price_data][product_data][name]", params.plan.name);
  if (params.plan.description) {
    form.set("line_items[0][price_data][product_data][description]", params.plan.description);
  }
  if (params.plan.interval) {
    form.set("line_items[0][price_data][recurring][interval]", params.plan.interval);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload = (await response.json()) as StripeCheckoutSession & {
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? `Stripe checkout session create failed with status ${response.status}`);
  }
  return payload;
}

async function retrieveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  const secretKey = normalizeOptionalString(process.env.STRIPE_SECRET_KEY);
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe billing.");
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const payload = (await response.json()) as StripeCheckoutSession & {
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? `Stripe checkout session retrieve failed with status ${response.status}`);
  }
  return payload;
}

function isStripeSessionPaid(session: StripeCheckoutSession): boolean {
  if (session.payment_status === "paid") {
    return true;
  }
  return session.status === "complete" && session.payment_status !== "unpaid";
}
