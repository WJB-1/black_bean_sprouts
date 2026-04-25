import path from "node:path";
import fs from "node:fs";
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

async function main() {
  console.log("smoke:billing - Testing auth + billing REST flow...");

  const restoreEnv = new Map([
    ["BILLING_PROVIDER", process.env.BILLING_PROVIDER],
    ["APP_BASE_URL", process.env.APP_BASE_URL],
  ]);
  process.env.BILLING_PROVIDER = "mock";
  process.env.APP_BASE_URL = "http://localhost:3000";

  try {
    const runtime = await loadRuntime();
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
      assertOk(plans[0]?.provider === "mock", "plans provider mismatch", plans);

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
        },
      });
      assertOk(checkoutResponse.statusCode === 200, "checkout status", checkoutResponse.body);
      const checkoutPayload = checkoutResponse.json();
      assertOk(checkoutPayload.provider === "mock", "checkout provider mismatch", checkoutPayload);
      assertOk(checkoutPayload.status === "PAID", "checkout status mismatch", checkoutPayload);
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

      console.log(
        `PASS: billing REST flow works (plans=${plans.length}, orders=${afterPayload.recentOrders.length}, subs=${afterPayload.subscriptions.length})`,
      );
    } finally {
      await app.close();
    }
  } finally {
    for (const [key, value] of restoreEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
