import {
  BillingOrderStatus,
  SubscriptionStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  parseAndVerifyAlipayNotification,
  prepareAlipayCheckout,
  queryAlipayTrade,
} from "./billing-alipay.js";
import {
  asRecord,
  BillingCheckoutKind,
  BillingDeveloperMode,
  BillingPlan,
  BillingPublicProvider,
  buildDeveloperSuccessUrl,
  fromStoredBillingProvider,
  getBillingPlans,
  normalizeOptionalString,
  requireBillingPlan,
  resolveAppBaseUrl,
  resolveConfiguredProviders,
  resolveDefaultBillingProvider,
  resolveDeveloperMode,
  resolveRequestedProvider,
  toStoredBillingProvider,
} from "./billing-shared.js";
import {
  parseAndVerifyWeChatPayNotification,
  prepareWeChatPayCheckout,
  queryWeChatPayOrder,
} from "./billing-wechatpay.js";

export type { BillingPublicProvider } from "./billing-shared.js";

export type BillingPlanSummary = BillingPlan & {
  readonly provider: BillingPublicProvider;
  readonly availableProviders: readonly BillingPublicProvider[];
};

export type BillingCheckoutResult = {
  readonly orderId: string;
  readonly provider: BillingPublicProvider;
  readonly checkoutUrl: string;
  readonly providerSessionId?: string;
  readonly status: "PENDING" | "PAID";
  readonly checkoutKind: BillingCheckoutKind;
  readonly checkoutPayload?: Record<string, unknown>;
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

export type BillingNotificationResult = {
  readonly statusCode: number;
  readonly contentType: string;
  readonly body: string;
};

export type BillingApplicationService = {
  listPlans(): Promise<readonly BillingPlanSummary[]>;
  getUserSummary(userId: string): Promise<BillingUserSummary>;
  createCheckout(params: {
    userId: string;
    email: string;
    planId: string;
    provider?: BillingPublicProvider;
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
  handleNotification(params: {
    provider: Extract<BillingPublicProvider, "alipay" | "wechatpay">;
    headers: Readonly<Record<string, string | string[] | undefined>>;
    rawBody: string;
  }): Promise<BillingNotificationResult>;
};

export type BillingApplicationDeps = {
  readonly prisma: PrismaClient;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
};

type StoredBillingOrder = NonNullable<
  Awaited<ReturnType<PrismaClient["billingOrder"]["findUnique"]>>
>;

type ProviderQueryResult = {
  readonly providerSessionId?: string;
  readonly providerSubscriptionId?: string;
  readonly paid: boolean;
  readonly metadata: Record<string, unknown>;
};

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function createBillingApplicationService(
  deps: BillingApplicationDeps,
): BillingApplicationService {
  const { prisma } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  const listPlanSummaries = async (): Promise<readonly BillingPlanSummary[]> => {
    const availableProviders = resolveConfiguredProviders();
    const defaultProvider = resolveDefaultBillingProvider(availableProviders);
    return getBillingPlans().map((plan) => ({
      ...plan,
      provider: defaultProvider,
      availableProviders,
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
      const availableProviders = resolveConfiguredProviders();
      const provider = resolveRequestedProvider(params.provider, availableProviders);

      if (provider === "developer") {
        return createDeveloperCheckout({
          prisma,
          now,
          plan,
          userId: params.userId,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
        });
      }

      const order = await prisma.billingOrder.create({
        data: {
          userId: params.userId,
          planId: plan.id,
          planName: plan.name,
          amountCents: plan.amountCents,
          currency: plan.currency,
          provider: toStoredBillingProvider(provider),
          status: BillingOrderStatus.PENDING,
          metadata: toInputJson({
            mode: provider,
            requestedSuccessUrl: params.successUrl,
            requestedCancelUrl: params.cancelUrl,
          }),
        },
      });

      try {
        if (provider === "stripe") {
          return createStripeCheckout({
            prisma,
            fetchImpl,
            plan,
            orderId: order.id,
            email: params.email,
            successUrl: params.successUrl,
            cancelUrl: params.cancelUrl,
          });
        }

        if (provider === "alipay") {
          const prepared = prepareAlipayCheckout({
            plan,
            orderId: order.id,
            successUrl: params.successUrl,
          });
          await prisma.billingOrder.update({
            where: { id: order.id },
            data: {
              providerSessionId: prepared.providerSessionId,
              checkoutUrl: prepared.checkoutUrl,
              metadata: toInputJson({
                mode: "alipay",
                productCode: "FAST_INSTANT_TRADE_PAY",
              }),
            },
          });
          return {
            orderId: order.id,
            provider,
            checkoutUrl: prepared.checkoutUrl,
            providerSessionId: prepared.providerSessionId,
            status: "PENDING",
            checkoutKind: "redirect",
          };
        }

        const prepared = await prepareWeChatPayCheckout({
          fetchImpl,
          plan,
          orderId: order.id,
        });
        await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            providerSessionId: prepared.providerSessionId,
            checkoutUrl: prepared.checkoutUrl,
            metadata: toInputJson({
              mode: "wechatpay",
              scene: "native",
            }),
          },
        });
        return {
          orderId: order.id,
          provider,
          checkoutUrl: prepared.checkoutUrl,
          providerSessionId: prepared.providerSessionId,
          status: "PENDING",
          checkoutKind: "qr",
          checkoutPayload: prepared.checkoutPayload,
        };
      } catch (error) {
        await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            status: BillingOrderStatus.FAILED,
            metadata: toInputJson({
              mode: provider,
              error: error instanceof Error ? error.message : String(error),
            }),
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

      const plan = requireBillingPlan(order.planId);
      const provider = fromStoredBillingProvider(order.provider);

      if (provider === "developer") {
        const subscription = await markOrderPaidAndActivateSubscription({
          prisma,
          now,
          order,
          plan,
          metadata: {
            mode: "developer",
            confirmedAt: now().toISOString(),
            developerMode: resolveDeveloperMode(),
          },
        });
        return {
          orderId: order.id,
          status: BillingOrderStatus.PAID,
          subscriptionStatus: subscription.status,
        };
      }

      const queryResult =
        provider === "stripe"
          ? await queryStripeCheckout({
              fetchImpl,
              order,
              providerSessionId: params.providerSessionId ?? order.providerSessionId ?? undefined,
            })
          : provider === "alipay"
            ? await queryAlipayTrade({
                fetchImpl,
                orderId: order.id,
              })
            : await queryWeChatPayOrder({
                fetchImpl,
                orderId: order.id,
              });

      if (!queryResult.paid) {
        await prisma.billingOrder.update({
          where: { id: order.id },
          data: {
            providerSessionId: queryResult.providerSessionId ?? order.providerSessionId ?? undefined,
            providerSubscriptionId:
              queryResult.providerSubscriptionId ?? order.providerSubscriptionId ?? undefined,
            metadata: toInputJson({
              ...(asRecord(order.metadata) ?? {}),
              ...queryResult.metadata,
            }),
          },
        });
        return {
          orderId: order.id,
          status: order.status,
        };
      }

      const subscription = await markOrderPaidAndActivateSubscription({
        prisma,
        now,
        order,
        plan,
        providerSessionId: queryResult.providerSessionId,
        providerSubscriptionId: queryResult.providerSubscriptionId,
        metadata: queryResult.metadata,
      });
      return {
        orderId: order.id,
        status: BillingOrderStatus.PAID,
        subscriptionStatus: subscription.status,
      };
    },

    async handleNotification(params) {
      try {
        const notification =
          params.provider === "alipay"
            ? parseAndVerifyAlipayNotification(params.rawBody)
            : parseAndVerifyWeChatPayNotification({
                headers: params.headers,
                rawBody: params.rawBody,
              });
        const order = await prisma.billingOrder.findUnique({
          where: { id: notification.orderId },
        });
        if (!order) {
          return providerNotificationResponse(params.provider, 404, false, "order not found");
        }

        if (notification.paid) {
          if (order.status !== BillingOrderStatus.PAID) {
            const plan = requireBillingPlan(order.planId);
            await markOrderPaidAndActivateSubscription({
              prisma,
              now,
              order,
              plan,
              providerSessionId: notification.providerSessionId,
              metadata: notification.metadata,
            });
          } else {
            await prisma.billingOrder.update({
              where: { id: order.id },
              data: {
                providerSessionId:
                  notification.providerSessionId ?? order.providerSessionId ?? undefined,
                metadata: toInputJson({
                  ...(asRecord(order.metadata) ?? {}),
                  ...notification.metadata,
                }),
              },
            });
          }
        } else {
          await prisma.billingOrder.update({
            where: { id: order.id },
            data: {
              metadata: toInputJson({
                ...(asRecord(order.metadata) ?? {}),
                ...notification.metadata,
              }),
            },
          });
        }

        return providerNotificationResponse(params.provider, 200, true);
      } catch (error) {
        return providerNotificationResponse(
          params.provider,
          401,
          false,
          error instanceof Error ? error.message : "notification verification failed",
        );
      }
    },
  };
}

async function createDeveloperCheckout(params: {
  prisma: PrismaClient;
  now: () => Date;
  plan: BillingPlan;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<BillingCheckoutResult> {
  const developerMode = resolveDeveloperMode();
  const providerSessionId = `dev_${params.now().getTime()}`;
  const checkoutUrl =
    developerMode === "instant"
      ? buildDeveloperSuccessUrl(params.plan.id)
      : `${resolveAppBaseUrl()}/billing/dev-checkout?orderId=${encodeURIComponent(providerSessionId)}&planId=${encodeURIComponent(params.plan.id)}`;

  const order = await params.prisma.billingOrder.create({
    data: {
      userId: params.userId,
      planId: params.plan.id,
      planName: params.plan.name,
      amountCents: params.plan.amountCents,
      currency: params.plan.currency,
      provider: toStoredBillingProvider("developer"),
      status:
        developerMode === "instant" ? BillingOrderStatus.PAID : BillingOrderStatus.PENDING,
      providerSessionId,
      checkoutUrl,
      paidAt: developerMode === "instant" ? params.now() : undefined,
      metadata: toInputJson({
        mode: "developer",
        developerMode,
        requestedSuccessUrl: params.successUrl,
        requestedCancelUrl: params.cancelUrl,
      }),
    },
  });

  if (developerMode === "instant") {
    await activateSubscriptionForOrder(params.prisma, order.id, params.plan, params.now);
    return {
      orderId: order.id,
      provider: "developer",
      checkoutUrl,
      providerSessionId,
      status: "PAID",
      checkoutKind: "redirect",
      checkoutPayload: {
        developerMode,
      },
    };
  }

  return {
    orderId: order.id,
    provider: "developer",
    checkoutUrl,
    providerSessionId,
    status: "PENDING",
    checkoutKind: "redirect",
    checkoutPayload: {
      developerMode,
      simulateConfirmEndpoint: "/api/billing/checkout/confirm",
      note: "Developer mode does not charge real money. Call confirm after your frontend simulates a successful payment.",
    },
  };
}

async function createStripeCheckout(params: {
  prisma: PrismaClient;
  fetchImpl: typeof fetch;
  plan: BillingPlan;
  orderId: string;
  email: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<BillingCheckoutResult> {
  const session = await createStripeCheckoutSession({
    fetchImpl: params.fetchImpl,
    orderId: params.orderId,
    email: params.email,
    plan: params.plan,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
  });

  const updatedOrder = await params.prisma.billingOrder.update({
    where: { id: params.orderId },
    data: {
      providerSessionId: session.id,
      checkoutUrl: session.url,
      metadata: toInputJson({
        mode: "stripe",
        sessionId: session.id,
      }),
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
    checkoutKind: "redirect",
  };
}

async function createStripeCheckoutSession(params: {
  fetchImpl: typeof fetch;
  orderId: string;
  email: string;
  plan: BillingPlan;
  successUrl?: string;
  cancelUrl?: string;
}) {
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

  const response = await params.fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload = (await response.json()) as {
    id?: string;
    url?: string;
    status?: string;
    payment_status?: string;
    subscription?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(
      payload.error?.message ??
        `Stripe checkout session create failed with status ${response.status}`,
    );
  }
  return payload;
}

async function queryStripeCheckout(params: {
  fetchImpl: typeof fetch;
  order: StoredBillingOrder;
  providerSessionId?: string;
}): Promise<ProviderQueryResult> {
  const sessionId = params.providerSessionId ?? params.order.providerSessionId;
  if (!sessionId) {
    throw new Error("providerSessionId is required to confirm a Stripe checkout.");
  }

  const secretKey = normalizeOptionalString(process.env.STRIPE_SECRET_KEY);
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe billing.");
  }

  const response = await params.fetchImpl(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    },
  );
  const payload = (await response.json()) as {
    id?: string;
    status?: string;
    payment_status?: string;
    subscription?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(
      payload.error?.message ??
        `Stripe checkout session retrieve failed with status ${response.status}`,
    );
  }

  return {
    providerSessionId: payload.id,
    providerSubscriptionId: payload.subscription ?? undefined,
    paid:
      payload.payment_status === "paid" ||
      (payload.status === "complete" && payload.payment_status !== "unpaid"),
    metadata: {
      mode: "stripe",
      confirmedAt: new Date().toISOString(),
      stripeStatus: payload.status,
      stripePaymentStatus: payload.payment_status,
    },
  };
}

async function activateSubscriptionForOrder(
  prisma: PrismaClient,
  orderId: string,
  plan: BillingPlan,
  now: () => Date,
  providerSubscriptionId?: string,
) {
  const order = await prisma.billingOrder.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    throw new Error("Billing order not found during subscription activation.");
  }

  const nowValue = now();
  await prisma.userSubscription.updateMany({
    where: {
      userId: order.userId,
      status: SubscriptionStatus.ACTIVE,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: nowValue,
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
      providerSubscriptionId,
      currentPeriodEnd: new Date(nowValue.getTime() + plan.accessDays * 24 * 60 * 60 * 1000),
    },
  });
}

async function markOrderPaidAndActivateSubscription(params: {
  prisma: PrismaClient;
  now: () => Date;
  order: StoredBillingOrder;
  plan: BillingPlan;
  providerSessionId?: string;
  providerSubscriptionId?: string;
  metadata?: Record<string, unknown>;
}) {
  const paidAt = params.now();
  await params.prisma.billingOrder.update({
    where: { id: params.order.id },
    data: {
      status: BillingOrderStatus.PAID,
      paidAt,
      providerSessionId: params.providerSessionId ?? params.order.providerSessionId ?? undefined,
      providerSubscriptionId:
        params.providerSubscriptionId ?? params.order.providerSubscriptionId ?? undefined,
      metadata: toInputJson({
        ...(asRecord(params.order.metadata) ?? {}),
        ...(params.metadata ?? {}),
      }),
    },
  });

  return activateSubscriptionForOrder(
    params.prisma,
    params.order.id,
    params.plan,
    params.now,
    params.providerSubscriptionId ?? params.order.providerSubscriptionId ?? undefined,
  );
}

function providerNotificationResponse(
  provider: "alipay" | "wechatpay",
  statusCode: number,
  ok: boolean,
  message?: string,
): BillingNotificationResult {
  if (provider === "alipay") {
    return {
      statusCode,
      contentType: "text/plain; charset=utf-8",
      body: ok ? "success" : "failure",
    };
  }

  return {
    statusCode,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      code: ok ? "SUCCESS" : "FAIL",
      message: ok ? "成功" : message ?? "notification verification failed",
    }),
  };
}
