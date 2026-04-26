import { createHash, randomUUID } from "node:crypto";
import { BillingProvider } from "@prisma/client";

export type BillingPublicProvider = "developer" | "stripe" | "alipay" | "wechatpay";
export type BillingPlanInterval = "month" | "year";
export type BillingCheckoutKind = "redirect" | "qr";
export type BillingDeveloperMode = "instant" | "manual";

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

const BILLING_PROVIDER_IDS: readonly BillingPublicProvider[] = [
  "developer",
  "stripe",
  "alipay",
  "wechatpay",
];

const DEFAULT_BILLING_PLANS: readonly BillingPlan[] = Object.freeze([
  {
    id: "starter-monthly",
    name: "Starter Monthly",
    description: "Structured generation + DOCX/LaTeX export",
    amountCents: 990,
    currency: "cny",
    interval: "month",
    accessDays: 30,
    features: ["workbench.generate", "workbench.export.docx", "workbench.export.latex"],
  },
  {
    id: "starter-yearly",
    name: "Starter Yearly",
    description: "Structured generation + DOCX/LaTeX export",
    amountCents: 9990,
    currency: "cny",
    interval: "year",
    accessDays: 365,
    features: ["workbench.generate", "workbench.export.docx", "workbench.export.latex"],
  },
]);

export function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function resolveAppBaseUrl(): string {
  return normalizeOptionalString(process.env.APP_BASE_URL) ?? "http://localhost:3000";
}

export function resolveDeveloperMode(): BillingDeveloperMode {
  const configured = normalizeOptionalString(process.env.BILLING_DEVELOPER_MODE)?.toLowerCase();
  return configured === "manual" ? "manual" : "instant";
}

export function resolveConfiguredProviders(): readonly BillingPublicProvider[] {
  const configured = normalizeOptionalString(process.env.BILLING_PROVIDERS);
  const legacyConfigured = normalizeOptionalString(process.env.BILLING_PROVIDER);

  const requestedProviders: BillingPublicProvider[] = configured
    ? configured
        .split(/[,\s]+/)
        .map((item) => item.trim().toLowerCase())
        .map((item) => {
          if (item === "mock") {
            return "developer";
          }
          if (BILLING_PROVIDER_IDS.includes(item as BillingPublicProvider)) {
            return item as BillingPublicProvider;
          }
          return undefined;
        })
        .filter((item): item is BillingPublicProvider => Boolean(item))
    : legacyConfigured
      ? [legacyConfigured === "mock" ? "developer" : (legacyConfigured as BillingPublicProvider)]
      : ["developer"];

  const deduped = requestedProviders.filter(
    (item, index, all): item is BillingPublicProvider => all.indexOf(item) === index,
  );
  const enabled = deduped.filter((provider) => hasProviderConfiguration(provider));
  return enabled.length > 0 ? enabled : ["developer"];
}

export function resolveDefaultBillingProvider(
  availableProviders: readonly BillingPublicProvider[],
): BillingPublicProvider {
  const explicit = normalizeOptionalString(process.env.BILLING_DEFAULT_PROVIDER)?.toLowerCase();
  if (explicit === "mock") {
    return "developer";
  }
  if (explicit && availableProviders.includes(explicit as BillingPublicProvider)) {
    return explicit as BillingPublicProvider;
  }
  return availableProviders[0] ?? "developer";
}

export function resolveRequestedProvider(
  requestedProvider: BillingPublicProvider | undefined,
  availableProviders: readonly BillingPublicProvider[],
): BillingPublicProvider {
  if (!requestedProvider) {
    return resolveDefaultBillingProvider(availableProviders);
  }
  if (!availableProviders.includes(requestedProvider)) {
    throw new Error(
      `Billing provider ${requestedProvider} is not enabled. Available providers: ${availableProviders.join(", ")}`,
    );
  }
  return requestedProvider;
}

export function hasProviderConfiguration(provider: BillingPublicProvider): boolean {
  switch (provider) {
    case "developer":
      return true;
    case "stripe":
      return Boolean(normalizeOptionalString(process.env.STRIPE_SECRET_KEY));
    case "alipay":
      return Boolean(
        normalizeOptionalString(process.env.ALIPAY_APP_ID) &&
          normalizeOptionalString(process.env.ALIPAY_APP_PRIVATE_KEY) &&
          normalizeOptionalString(process.env.ALIPAY_ALIPAY_PUBLIC_KEY),
      );
    case "wechatpay":
      return Boolean(
        normalizeOptionalString(process.env.WECHAT_PAY_APP_ID) &&
          normalizeOptionalString(process.env.WECHAT_PAY_MCH_ID) &&
          normalizeOptionalString(process.env.WECHAT_PAY_MCH_SERIAL_NO) &&
          normalizeOptionalString(process.env.WECHAT_PAY_PRIVATE_KEY) &&
          normalizeOptionalString(process.env.WECHAT_PAY_API_V3_KEY),
      );
  }
}

export function toStoredBillingProvider(provider: BillingPublicProvider): BillingProvider {
  switch (provider) {
    case "developer":
      return BillingProvider.MOCK;
    case "stripe":
      return BillingProvider.STRIPE;
    case "alipay":
      return "ALIPAY" as BillingProvider;
    case "wechatpay":
      return "WECHAT_PAY" as BillingProvider;
  }
}

export function fromStoredBillingProvider(provider: BillingProvider): BillingPublicProvider {
  if (provider === BillingProvider.MOCK) {
    return "developer";
  }
  if (provider === BillingProvider.STRIPE) {
    return "stripe";
  }
  if (provider === ("ALIPAY" as BillingProvider)) {
    return "alipay";
  }
  if (provider === ("WECHAT_PAY" as BillingProvider)) {
    return "wechatpay";
  }
  throw new Error(`Unsupported billing provider value: ${String(provider)}`);
}

export function getBillingPlans(): readonly BillingPlan[] {
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

export function requireBillingPlan(planId: string): BillingPlan {
  const plan = getBillingPlans().find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown billing plan: ${planId}`);
  }
  return plan;
}

export function buildDeveloperSuccessUrl(planId: string): string {
  const token = createHash("sha256")
    .update(`${planId}:${randomUUID()}`)
    .digest("hex")
    .slice(0, 16);
  return `${resolveAppBaseUrl()}/billing/mock-success?token=${token}`;
}

function normalizeBillingPlan(value: unknown): BillingPlan | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const amountCents =
    typeof record.amountCents === "number" ? record.amountCents : Number(record.amountCents);
  const currency = typeof record.currency === "string" ? record.currency.trim().toLowerCase() : "";
  const interval =
    record.interval === "month" || record.interval === "year" ? record.interval : undefined;
  const accessDays =
    typeof record.accessDays === "number" ? record.accessDays : Number(record.accessDays);
  const features = Array.isArray(record.features)
    ? record.features.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (
    !id ||
    !name ||
    !Number.isFinite(amountCents) ||
    amountCents <= 0 ||
    !currency ||
    !Number.isFinite(accessDays) ||
    accessDays <= 0
  ) {
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
