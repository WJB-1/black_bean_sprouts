import path from "node:path";
import fs from "node:fs";
import {
  createCipheriv,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
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
      const body = typeof init.body === "string" ? new URLSearchParams(init.body) : new URLSearchParams();
      return responseJson(200, {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/test/cs_test_123",
        status: "open",
        payment_status: "unpaid",
        client_reference_id: body.get("client_reference_id"),
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
      const body = typeof init.body === "string" ? new URLSearchParams(init.body) : new URLSearchParams();
      const method = body.get("method");
      const bizContent = safeJsonParse(body.get("biz_content") ?? "{}");
      if (method === "alipay.trade.query") {
        return responseJson(200, {
          alipay_trade_query_response: {
            code: "10000",
            trade_status: "TRADE_SUCCESS",
            trade_no: "alipay_trade_query_001",
            out_trade_no: bizContent.out_trade_no ?? "unknown-order",
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

async function createBillingTestApp(runtime, envOverrides, fetchImpl) {
  const prisma = createFakePrisma();
  const billingService = runtime.createBillingApplicationService({ prisma, fetchImpl });
  const app = runtime.Fastify({ logger: false });

  await app.register(runtime.jwt, { secret: "smoke-secret" });
  await app.register(runtime.authPlugin);
  await app.register(runtime.createAuthRoutes({ prisma }));
  await app.register(runtime.createBillingRoutes({ billingService }), { prefix: "/api/billing" });

  return {
    prisma,
    billingService,
    app,
    envOverrides,
  };
}

async function loginAndGetAuthHeader(app, email = "user@example.com") {
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email,
      name: "Smoke User",
    },
  });
  assertOk(loginResponse.statusCode === 200, "login status", loginResponse.body);
  const loginPayload = loginResponse.json();
  assertOk(
    typeof loginPayload.token === "string" && loginPayload.token.length > 20,
    "login token missing",
  );
  return {
    authorization: `Bearer ${loginPayload.token}`,
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
      const { app } = await createBillingTestApp(runtime, {}, createFakeFetch());
      try {
        const authHeader = await loginAndGetAuthHeader(app);

        const plansResponse = await app.inject({
          method: "GET",
          url: "/api/billing/plans",
        });
        assertOk(plansResponse.statusCode === 200, "plans status", plansResponse.body);
        const plans = plansResponse.json();
        assertOk(Array.isArray(plans) && plans.length >= 1, "plans list empty");
        assertOk(plans[0]?.provider === "developer", "default provider mismatch", plans);
        assertOk(
          Array.isArray(plans[0]?.availableProviders) &&
            plans[0].availableProviders.includes("developer"),
          "available providers mismatch",
          plans,
        );

        const checkoutResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout",
          headers: authHeader,
          payload: {
            planId: "starter-monthly",
            provider: "developer",
          },
        });
        assertOk(checkoutResponse.statusCode === 200, "developer checkout status", checkoutResponse.body);
        const checkoutPayload = checkoutResponse.json();
        assertOk(checkoutPayload.provider === "developer", "developer provider mismatch", checkoutPayload);
        assertOk(checkoutPayload.status === "PENDING", "developer manual mode should be pending", checkoutPayload);

        const confirmResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout/confirm",
          headers: authHeader,
          payload: {
            orderId: checkoutPayload.orderId,
          },
        });
        assertOk(confirmResponse.statusCode === 200, "developer confirm status", confirmResponse.body);
        const confirmPayload = confirmResponse.json();
        assertOk(confirmPayload.status === BillingOrderStatus.PAID, "developer confirm status mismatch", confirmPayload);
        assertOk(
          confirmPayload.subscriptionStatus === SubscriptionStatus.ACTIVE,
          "developer confirm subscription mismatch",
          confirmPayload,
        );

        const summaryAfter = await app.inject({
          method: "GET",
          url: "/api/billing/me",
          headers: authHeader,
        });
        assertOk(summaryAfter.statusCode === 200, "developer summary status", summaryAfter.body);
        const afterPayload = summaryAfter.json();
        assertOk(afterPayload.subscriptions.length === 1, "developer summary subscription count", afterPayload);
        assertOk(afterPayload.recentOrders[0]?.provider === BillingProvider.MOCK, "developer order provider mismatch", afterPayload);
      } finally {
        await app.close();
      }
    },
  );
}

async function runStripeRouteSmoke(runtime) {
  await withEnv(
    {
      APP_BASE_URL: "http://localhost:3000",
      BILLING_PROVIDERS: "stripe,developer",
      BILLING_DEFAULT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_demo",
    },
    async () => {
      const { app } = await createBillingTestApp(runtime, {}, createFakeFetch());
      try {
        const authHeader = await loginAndGetAuthHeader(app, "stripe@example.com");

        const checkoutResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout",
          headers: authHeader,
          payload: {
            planId: "starter-monthly",
            provider: "stripe",
          },
        });
        assertOk(checkoutResponse.statusCode === 200, "stripe checkout status", checkoutResponse.body);
        const checkoutPayload = checkoutResponse.json();
        assertOk(checkoutPayload.provider === "stripe", "stripe provider mismatch", checkoutPayload);
        assertOk(checkoutPayload.checkoutKind === "redirect", "stripe checkout kind mismatch", checkoutPayload);
        assertOk(checkoutPayload.status === "PENDING", "stripe should start pending", checkoutPayload);

        const confirmResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout/confirm",
          headers: authHeader,
          payload: {
            orderId: checkoutPayload.orderId,
            providerSessionId: checkoutPayload.providerSessionId,
          },
        });
        assertOk(confirmResponse.statusCode === 200, "stripe confirm status", confirmResponse.body);
        const confirmPayload = confirmResponse.json();
        assertOk(confirmPayload.status === BillingOrderStatus.PAID, "stripe confirm status mismatch", confirmPayload);
      } finally {
        await app.close();
      }
    },
  );
}

async function runAlipayNotifyRouteSmoke(runtime) {
  const merchantKeys = generatePemPair();
  const alipayKeys = generatePemPair();

  await withEnv(
    {
      APP_BASE_URL: "http://localhost:3000",
      BILLING_PROVIDERS: "alipay,developer",
      BILLING_DEFAULT_PROVIDER: "alipay",
      ALIPAY_APP_ID: "2026000000000001",
      ALIPAY_GATEWAY_URL: "https://openapi.alipay.com/gateway.do",
      ALIPAY_APP_PRIVATE_KEY: merchantKeys.privateKey,
      ALIPAY_ALIPAY_PUBLIC_KEY: alipayKeys.publicKey,
      ALIPAY_RETURN_URL: "http://localhost:3000/billing/success",
      ALIPAY_NOTIFY_URL: "http://localhost:3000/api/billing/providers/alipay/notify",
    },
    async () => {
      const { app } = await createBillingTestApp(runtime, {}, createFakeFetch());
      try {
        const authHeader = await loginAndGetAuthHeader(app, "alipay@example.com");

        const checkoutResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout",
          headers: authHeader,
          payload: {
            planId: "starter-monthly",
            provider: "alipay",
          },
        });
        assertOk(checkoutResponse.statusCode === 200, "alipay checkout status", checkoutResponse.body);
        const checkoutPayload = checkoutResponse.json();
        assertOk(checkoutPayload.provider === "alipay", "alipay provider mismatch", checkoutPayload);
        assertOk(checkoutPayload.checkoutKind === "redirect", "alipay checkout kind mismatch", checkoutPayload);

        const notifyParams = {
          app_id: process.env.ALIPAY_APP_ID,
          charset: "utf-8",
          gmt_create: "2026-04-26 10:00:00",
          notify_id: "notify_001",
          notify_time: "2026-04-26 10:01:00",
          notify_type: "trade_status_sync",
          out_trade_no: checkoutPayload.orderId,
          seller_id: "2088000000000000",
          subject: "Starter Monthly",
          total_amount: "9.90",
          trade_no: "alipay_trade_notify_001",
          trade_status: "TRADE_SUCCESS",
          version: "1.0",
        };
        notifyParams.sign = signAlipayNotification(notifyParams, alipayKeys.privateKey);

        const notifyResponse = await app.inject({
          method: "POST",
          url: "/api/billing/providers/alipay/notify",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          payload: new URLSearchParams(notifyParams).toString(),
        });
        assertOk(notifyResponse.statusCode === 200, "alipay notify status", notifyResponse.body);
        assertOk(notifyResponse.body.trim() === "success", "alipay notify body mismatch", notifyResponse.body);

        const summaryResponse = await app.inject({
          method: "GET",
          url: "/api/billing/me",
          headers: authHeader,
        });
        assertOk(summaryResponse.statusCode === 200, "alipay summary status", summaryResponse.body);
        const summaryPayload = summaryResponse.json();
        assertOk(summaryPayload.subscriptions.length === 1, "alipay subscription not activated", summaryPayload);
        assertOk(summaryPayload.recentOrders[0]?.provider === "ALIPAY", "alipay stored provider mismatch", summaryPayload);
      } finally {
        await app.close();
      }
    },
  );
}

async function runWeChatNotifyRouteSmoke(runtime) {
  const merchantKeys = generatePemPair();
  const platformKeys = generatePemPair();
  const apiV3Key = "0123456789abcdef0123456789abcdef";

  await withEnv(
    {
      APP_BASE_URL: "http://localhost:3000",
      BILLING_PROVIDERS: "wechatpay,developer",
      BILLING_DEFAULT_PROVIDER: "wechatpay",
      WECHAT_PAY_APP_ID: "wx1234567890",
      WECHAT_PAY_MCH_ID: "1900000001",
      WECHAT_PAY_MCH_SERIAL_NO: "7777777777777777777777777777777777777777",
      WECHAT_PAY_PRIVATE_KEY: merchantKeys.privateKey,
      WECHAT_PAY_API_V3_KEY: apiV3Key,
      WECHAT_PAY_PLATFORM_CERT: platformKeys.publicKey,
      WECHAT_PAY_PLATFORM_CERT_SERIAL: "PLATFORM_SERIAL_TEST",
      WECHAT_PAY_NOTIFY_URL: "http://localhost:3000/api/billing/providers/wechatpay/notify",
    },
    async () => {
      const { app } = await createBillingTestApp(runtime, {}, createFakeFetch());
      try {
        const authHeader = await loginAndGetAuthHeader(app, "wechatpay@example.com");

        const checkoutResponse = await app.inject({
          method: "POST",
          url: "/api/billing/checkout",
          headers: authHeader,
          payload: {
            planId: "starter-monthly",
            provider: "wechatpay",
          },
        });
        assertOk(checkoutResponse.statusCode === 200, "wechatpay checkout status", checkoutResponse.body);
        const checkoutPayload = checkoutResponse.json();
        assertOk(checkoutPayload.provider === "wechatpay", "wechatpay provider mismatch", checkoutPayload);
        assertOk(checkoutPayload.checkoutKind === "qr", "wechatpay checkout kind mismatch", checkoutPayload);

        const wechatNotification = buildWeChatNotificationPayload({
          apiV3Key,
          platformPrivateKey: platformKeys.privateKey,
          platformSerial: "PLATFORM_SERIAL_TEST",
          orderId: checkoutPayload.orderId,
          transactionId: "wx_txn_notify_001",
        });

        const notifyResponse = await app.inject({
          method: "POST",
          url: "/api/billing/providers/wechatpay/notify",
          headers: {
            "content-type": "application/json",
            "wechatpay-signature": wechatNotification.headers.signature,
            "wechatpay-nonce": wechatNotification.headers.nonce,
            "wechatpay-timestamp": wechatNotification.headers.timestamp,
            "wechatpay-serial": wechatNotification.headers.serial,
          },
          payload: wechatNotification.rawBody,
        });
        assertOk(notifyResponse.statusCode === 200, "wechatpay notify status", notifyResponse.body);
        const notifyPayload = JSON.parse(notifyResponse.body);
        assertOk(notifyPayload.code === "SUCCESS", "wechatpay notify body mismatch", notifyPayload);

        const summaryResponse = await app.inject({
          method: "GET",
          url: "/api/billing/me",
          headers: authHeader,
        });
        assertOk(summaryResponse.statusCode === 200, "wechatpay summary status", summaryResponse.body);
        const summaryPayload = summaryResponse.json();
        assertOk(summaryPayload.subscriptions.length === 1, "wechatpay subscription not activated", summaryPayload);
        assertOk(summaryPayload.recentOrders[0]?.provider === "WECHAT_PAY", "wechatpay stored provider mismatch", summaryPayload);
      } finally {
        await app.close();
      }
    },
  );
}

function signAlipayNotification(params, privateKeyPem) {
  const content = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKeyPem, "base64");
}

function buildWeChatNotificationPayload(params) {
  const nonce = randomBytes(12).toString("hex").slice(0, 12);
  const associatedData = "transaction";
  const resourcePlaintext = JSON.stringify({
    out_trade_no: params.orderId,
    transaction_id: params.transactionId,
    trade_state: "SUCCESS",
  });

  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(params.apiV3Key, "utf8"),
    Buffer.from(nonce, "utf8"),
  );
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(resourcePlaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");

  const envelope = {
    id: "notify_id_001",
    create_time: "2026-04-26T10:10:00+08:00",
    event_type: "TRANSACTION.SUCCESS",
    resource_type: "encrypt-resource",
    summary: "payment success",
    resource: {
      algorithm: "AEAD_AES_256_GCM",
      ciphertext,
      associated_data: associatedData,
      nonce,
    },
  };

  const rawBody = JSON.stringify(envelope);
  const signatureNonce = randomBytes(16).toString("hex");
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const signatureMessage = `${timestamp}\n${signatureNonce}\n${rawBody}\n`;
  const signer = createSign("RSA-SHA256");
  signer.update(signatureMessage, "utf8");
  signer.end();
  const signature = signer.sign(params.platformPrivateKey, "base64");

  return {
    rawBody,
    headers: {
      signature,
      nonce: signatureNonce,
      timestamp,
      serial: params.platformSerial,
    },
  };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  console.log("smoke:billing - Testing route-level billing paths...");
  const runtime = await loadRuntime();
  await runDeveloperRouteSmoke(runtime);
  await runStripeRouteSmoke(runtime);
  await runAlipayNotifyRouteSmoke(runtime);
  await runWeChatNotifyRouteSmoke(runtime);
  console.log("PASS: route-level billing smoke covers developer, Stripe confirm, Alipay notify, and WeChat notify paths");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
