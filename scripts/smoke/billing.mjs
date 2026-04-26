import path from "node:path";
import fs from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BillingOrderStatus,
  BillingProvider,
  SubscriptionStatus,
} from "@prisma/client";

function assertOk(condition, message, details) {
  if (condition) {
    return;
  }

  console.error(`FAIL: ${message}`);
  if (details !== undefined) {
    console.error(details);
  }
  process.exit(1);
}

function ensureBuiltArtifact(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }
  throw new Error(`Missing built artifact at ${filePath}. Run \`pnpm build\` first.`);
}

function sortByCreatedDesc(items) {
  return [...items].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function createFakePrisma() {
  const users = [];
  const orders = [];
  const subscriptions = [];
  let userSeq = 0;
  let orderSeq = 0;
  let subscriptionSeq = 0;

  return {
    user: {
      async upsert(args) {
        const now = new Date();
        const existing = users.find((item) => item.email === args.where.email);
        if (existing) {
          if (args.update.name !== undefined) {
            existing.name = args.update.name ?? null;
          }
          if (args.update.role !== undefined) {
            existing.role = args.update.role;
          }
          existing.updatedAt = now;
          return existing;
        }

        const next = {
          id: `user_${++userSeq}`,
          email: args.create.email,
          name: args.create.name ?? null,
          role: args.create.role,
          createdAt: now,
          updatedAt: now,
        };
        users.push(next);
        return next;
      },
    },
    billingOrder: {
      async findMany(args = {}) {
        const filtered = args.where?.userId
          ? orders.filter((item) => item.userId === args.where.userId)
          : orders;
        const sorted = sortByCreatedDesc(filtered);
        return typeof args.take === "number" ? sorted.slice(0, args.take) : sorted;
      },
      async create(args) {
        const now = new Date();
        const next = {
          id: `order_${++orderSeq}`,
          createdAt: now,
          updatedAt: now,
          providerSessionId: null,
          providerSubscriptionId: null,
          checkoutUrl: null,
          metadata: {},
          paidAt: null,
          ...args.data,
          providerSessionId: args.data.providerSessionId ?? null,
          providerSubscriptionId: args.data.providerSubscriptionId ?? null,
          checkoutUrl: args.data.checkoutUrl ?? null,
          metadata: args.data.metadata ?? {},
          paidAt: args.data.paidAt ?? null,
        };
        orders.push(next);
        return next;
      },
      async update(args) {
        const existing = orders.find((item) => item.id === args.where.id);
        if (!existing) {
          throw new Error(`Billing order not found: ${args.where.id}`);
        }
        Object.assign(existing, args.data, { updatedAt: new Date() });
        return existing;
      },
      async findUnique(args) {
        return orders.find((item) => item.id === args.where.id) ?? null;
      },
    },
    userSubscription: {
      async findMany(args = {}) {
        const filtered = args.where?.userId
          ? subscriptions.filter((item) => item.userId === args.where.userId)
          : subscriptions;
        return sortByCreatedDesc(filtered);
      },
      async findFirst(args = {}) {
        const filtered = args.where?.sourceOrderId
          ? subscriptions.filter((item) => item.sourceOrderId === args.where.sourceOrderId)
          : subscriptions;
        return sortByCreatedDesc(filtered)[0] ?? null;
      },
      async updateMany(args) {
        let count = 0;
        for (const item of subscriptions) {
          if (args.where?.userId && item.userId !== args.where.userId) {
            continue;
          }
          if (args.where?.status && item.status !== args.where.status) {
            continue;
          }
          Object.assign(item, args.data, { updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
      async create(args) {
        const now = new Date();
        const next = {
          id: `sub_${++subscriptionSeq}`,
          createdAt: now,
          updatedAt: now,
          startedAt: args.data.startedAt ?? now,
          sourceOrderId: null,
          providerSubscriptionId: null,
          currentPeriodEnd: null,
          canceledAt: null,
          ...args.data,
          sourceOrderId: args.data.sourceOrderId ?? null,
          providerSubscriptionId: args.data.providerSubscriptionId ?? null,
          currentPeriodEnd: args.data.currentPeriodEnd ?? null,
          canceledAt: args.data.canceledAt ?? null,
        };
        subscriptions.push(next);
        return next;
      },
    },
  };
}

async function loadRuntime() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..", "..");
  const serverPackageJsonPath = path.join(repoRoot, "packages", "server", "package.json");
  const authPath = path.join(repoRoot, "packages", "server", "dist", "plugins", "auth.js");
  const billingRoutePath = path.join(repoRoot, "packages", "server", "dist", "routes", "billing", "index.js");
  const billingServicePath = path.join(repoRoot, "packages", "server", "dist", "services", "billing-application.js");
  const serverRequire = createRequire(pathToFileURL(serverPackageJsonPath));
  const Fastify = serverRequire("fastify");
  const jwt = serverRequire("@fastify/jwt");

  ensureBuiltArtifact(authPath);
  ensureBuiltArtifact(billingRoutePath);
  ensureBuiltArtifact(billingServicePath);

  const [{ authPlugin, createAuthRoutes }, { createBillingRoutes }, { createBillingApplicationService }] =
    await Promise.all([
      import(pathToFileURL(authPath).href),
      import(pathToFileURL(billingRoutePath).href),
      import(pathToFileURL(billingServicePath).href),
    ]);

  return {
    Fastify,
    jwt,
    authPlugin,
    createAuthRoutes,
    createBillingRoutes,
    createBillingApplicationService,
  };
}

function withEnv(overrides, run) {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function createFakeFetch() {
  return async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;

    if (url === "https://api.stripe.com/v1/checkout/sessions") {
      return responseJson(200, {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/test/cs_test_123",
        status: "open",
        payment_status: "unpaid",
      });
    }

    if (url.includes("https://api.stripe.com/v1/checkout/sessions/")) {
      return responseJson(200, {
        id: "cs_test_123",
        status: "complete",
        payment_status: "paid",
        subscription: "sub_test_123",
      });
    }

    if (url.includes("openapi.alipay.com/gateway.do")) {
      const body = typeof init.body === "string" ? init.body : "";
      if (body.includes("alipay.trade.query")) {
        return responseJson(200, {
          alipay_trade_query_response: {
            code: "10000",
            trade_status: "TRADE_SUCCESS",
            trade_no: "alipay_trade_001",
            out_trade_no: "order_1",
          },
        });
      }
      return responseJson(200, {});
    }

    if (url.endsWith("/v3/pay/transactions/native")) {
      return responseJson(200, {
        code_url: "weixin://wxpay/bizpayurl?pr=test-native",
      });
    }

    if (url.includes("/v3/pay/transactions/out-trade-no/")) {
      return responseJson(200, {
        trade_state: "SUCCESS",
        transaction_id: "wx_txn_001",
      });
    }

    throw new Error(`Unexpected fetch request in billing smoke: ${url}`);
  };
}

function responseJson(status, payload) {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    async json() {
      return payload;
    },
    async text() {
      return text;
    },
  };
}

function generatePemPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

async function runDeveloperRouteSmoke(runtime) {
  await withEnv(
    {
      APP_BASE_URL: "http://localhost:3000",
      BILLING_PROVIDERS: "developer",
      BILLING_DEFAULT_PROVIDER: "developer",
      BILLING_DEVELOPER_MODE: "manual",
    },
    async () => {
      const prisma = createFakePrisma();
      const billingService = runtime.createBillingApplicationService({ prisma });
      const app = runtime.Fastify({ logger: false });

      await app.register(runtime.jwt, { secret: "smoke-secret" });
      await app.register(runtime.authPlugin);
      await app.register(runtime.createAuthRoutes({ prisma }));
      await app.register(runtime.createBillingRoutes({ billingService }), { prefix: "/api/billing" });

      try {
        const loginResponse = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "user@example.com",
            name: "Smoke User",
          },
        });
        assertOk(loginResponse.statusCode === 200, "login status", loginResponse.body);
        const loginPayload = loginResponse.json();
        assertOk(typeof loginPayload.token === "string" && loginPayload.token.length > 20, "login token missing");

        const authHeader = {
          authorization: `Bearer ${loginPayload.token}`,
        };

        const plansResponse = await app.inject({
          method: "GET",
          url: "/api/billing/plans",
        });
        assertOk(plansResponse.statusCode === 200, "plans status", plansResponse.body);
        const plans = plansResponse.json();
        assertOk(Array.isArray(plans) && plans.length >= 1, "plans list empty");
        assertOk(plans[0]?.provider === "developer", "default provider mismatch", plans);
        assertOk(
          Array.isArray(plans[0]?.availableProviders) && plans[0].availableProviders.includes("developer"),
          "available providers mismatch",
          plans,
        );

        const summaryBefore = await app.inject({
          method: "GET",
          url: "/api/billing/me",
          headers: authHeader,
        });
        assertOk(summaryBefore.statusCode === 200, "billing summary before checkout", summaryBefore.body);
        const beforePayload = summaryBefore.json();
        assertOk(Array.isArray(beforePayload.subscriptions) && beforePayload.subscriptions.length === 0, "expected no subscriptions before checkout");
        assertOk(Array.isArray(beforePayload.recentOrders) && beforePayload.recentOrders.length === 0, "expected no orders before checkout");

        const checkoutResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout",
          headers: authHeader,
          payload: {
            planId: "starter-monthly",
            provider: "developer",
          },
        });
        assertOk(checkoutResponse.statusCode === 200, "checkout status", checkoutResponse.body);
        const checkoutPayload = checkoutResponse.json();
        assertOk(checkoutPayload.provider === "developer", "checkout provider mismatch", checkoutPayload);
        assertOk(checkoutPayload.status === "PENDING", "developer manual mode should be pending", checkoutPayload);
        assertOk(checkoutPayload.checkoutKind === "redirect", "developer checkout kind mismatch", checkoutPayload);
        assertOk(typeof checkoutPayload.orderId === "string", "checkout order id missing");

        const confirmResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout/confirm",
          headers: authHeader,
          payload: {
            orderId: checkoutPayload.orderId,
          },
        });
        assertOk(confirmResponse.statusCode === 200, "confirm status", confirmResponse.body);
        const confirmPayload = confirmResponse.json();
        assertOk(confirmPayload.status === BillingOrderStatus.PAID, "confirm status mismatch", confirmPayload);
        assertOk(confirmPayload.subscriptionStatus === SubscriptionStatus.ACTIVE, "confirm subscription status mismatch", confirmPayload);

        const summaryAfter = await app.inject({
          method: "GET",
          url: "/api/billing/me",
          headers: authHeader,
        });
        assertOk(summaryAfter.statusCode === 200, "billing summary after checkout", summaryAfter.body);
        const afterPayload = summaryAfter.json();
        assertOk(afterPayload.subscriptions.length === 1, "expected one active subscription", afterPayload);
        assertOk(afterPayload.recentOrders.length === 1, "expected one recent order", afterPayload);
        assertOk(afterPayload.recentOrders[0]?.status === BillingOrderStatus.PAID, "recent order status mismatch", afterPayload);
        assertOk(afterPayload.recentOrders[0]?.provider === BillingProvider.MOCK, "recent order provider mismatch", afterPayload);
      } finally {
        await app.close();
      }
    },
  );
}

async function runProviderPreparationSmoke(runtime) {
  const alipayKeys = generatePemPair();
  const wechatMerchantKeys = generatePemPair();
  const wechatPlatformKeys = generatePemPair();
  const fakeFetch = createFakeFetch();

  await withEnv(
    {
      APP_BASE_URL: "http://localhost:3000",
      BILLING_PROVIDERS: "alipay,wechatpay,stripe,developer",
      BILLING_DEFAULT_PROVIDER: "alipay",
      BILLING_DEVELOPER_MODE: "manual",
      STRIPE_SECRET_KEY: "sk_test_demo",
      ALIPAY_APP_ID: "2026000000000001",
      ALIPAY_GATEWAY_URL: "https://openapi.alipay.com/gateway.do",
      ALIPAY_APP_PRIVATE_KEY: alipayKeys.privateKey,
      ALIPAY_ALIPAY_PUBLIC_KEY: alipayKeys.publicKey,
      ALIPAY_RETURN_URL: "http://localhost:3000/billing/success",
      WECHAT_PAY_APP_ID: "wx1234567890",
      WECHAT_PAY_MCH_ID: "1900000001",
      WECHAT_PAY_MCH_SERIAL_NO: "7777777777777777777777777777777777777777",
      WECHAT_PAY_PRIVATE_KEY: wechatMerchantKeys.privateKey,
      WECHAT_PAY_API_V3_KEY: "0123456789abcdef0123456789abcdef",
      WECHAT_PAY_PLATFORM_CERT: wechatPlatformKeys.publicKey,
      WECHAT_PAY_PLATFORM_CERT_SERIAL: "PLATFORM_SERIAL_TEST",
    },
    async () => {
      const prisma = createFakePrisma();
      const service = runtime.createBillingApplicationService({
        prisma,
        fetchImpl: fakeFetch,
      });

      const plans = await service.listPlans();
      assertOk(plans[0]?.availableProviders.includes("alipay"), "alipay should be listed", plans);
      assertOk(plans[0]?.availableProviders.includes("wechatpay"), "wechatpay should be listed", plans);
      assertOk(plans[0]?.availableProviders.includes("stripe"), "stripe should be listed", plans);

      const alipayCheckout = await service.createCheckout({
        userId: "user_provider_1",
        email: "provider@example.com",
        planId: "starter-monthly",
        provider: "alipay",
      });
      assertOk(alipayCheckout.provider === "alipay", "alipay checkout provider mismatch", alipayCheckout);
      assertOk(alipayCheckout.status === "PENDING", "alipay checkout should be pending", alipayCheckout);
      assertOk(alipayCheckout.checkoutKind === "redirect", "alipay checkout kind mismatch", alipayCheckout);
      assertOk(alipayCheckout.checkoutUrl.startsWith("https://openapi.alipay.com/gateway.do?"), "alipay checkout url mismatch", alipayCheckout);

      const alipayConfirm = await service.confirmCheckout({
        userId: "user_provider_1",
        orderId: alipayCheckout.orderId,
      });
      assertOk(alipayConfirm.status === BillingOrderStatus.PAID, "alipay confirm should mark order paid", alipayConfirm);

      const wechatCheckout = await service.createCheckout({
        userId: "user_provider_2",
        email: "wechat@example.com",
        planId: "starter-monthly",
        provider: "wechatpay",
      });
      assertOk(wechatCheckout.provider === "wechatpay", "wechatpay checkout provider mismatch", wechatCheckout);
      assertOk(wechatCheckout.status === "PENDING", "wechatpay checkout should be pending", wechatCheckout);
      assertOk(wechatCheckout.checkoutKind === "qr", "wechatpay checkout kind mismatch", wechatCheckout);
      assertOk(
        wechatCheckout.checkoutPayload?.qrCodeUrl === "weixin://wxpay/bizpayurl?pr=test-native",
        "wechatpay qr payload mismatch",
        wechatCheckout,
      );

      const wechatConfirm = await service.confirmCheckout({
        userId: "user_provider_2",
        orderId: wechatCheckout.orderId,
      });
      assertOk(wechatConfirm.status === BillingOrderStatus.PAID, "wechatpay confirm should mark order paid", wechatConfirm);
    },
  );
}

async function main() {
  console.log("smoke:billing - Testing auth + billing REST flow...");
  const runtime = await loadRuntime();
  await runDeveloperRouteSmoke(runtime);
  await runProviderPreparationSmoke(runtime);
  console.log("PASS: billing REST flow works for developer mode, plus Alipay and WeChat Pay preparation/query chains");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
