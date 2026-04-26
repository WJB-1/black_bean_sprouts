import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  type KeyObject,
} from "node:crypto";
import type { BillingPlan } from "./billing-shared.js";
import { normalizeOptionalString, resolveAppBaseUrl } from "./billing-shared.js";

export type AlipayCheckoutPreparation = {
  readonly checkoutUrl: string;
  readonly providerSessionId: string;
};

export type AlipayQueryResult = {
  readonly providerSessionId?: string;
  readonly providerSubscriptionId?: string;
  readonly paid: boolean;
  readonly metadata: Record<string, unknown>;
};

export type AlipayNotificationPayload = {
  readonly orderId: string;
  readonly providerSessionId?: string;
  readonly paid: boolean;
  readonly metadata: Record<string, unknown>;
};

type AlipayTradeQueryResponse = {
  code?: string;
  msg?: string;
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: string;
  total_amount?: string;
};

const DEFAULT_ALIPAY_GATEWAY_URL = "https://openapi.alipay.com/gateway.do";

export function prepareAlipayCheckout(params: {
  plan: BillingPlan;
  orderId: string;
  successUrl?: string;
}): AlipayCheckoutPreparation {
  const checkoutUrl = buildAlipayGatewayUrl({
    gatewayUrl: resolveAlipayGatewayUrl(),
    params: buildAlipaySignedRequest({
      method: "alipay.trade.page.pay",
      bizContent: {
        out_trade_no: params.orderId,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: formatAmountYuan(params.plan.amountCents),
        subject: params.plan.name,
        body: params.plan.description,
        timeout_express: "15m",
      },
      notifyUrl: resolveAlipayNotifyUrl(),
      returnUrl:
        normalizeOptionalString(params.successUrl) ??
        normalizeOptionalString(process.env.ALIPAY_RETURN_URL) ??
        normalizeOptionalString(process.env.BILLING_SUCCESS_URL),
    }),
  });

  return {
    checkoutUrl,
    providerSessionId: params.orderId,
  };
}

export async function queryAlipayTrade(params: {
  fetchImpl: typeof fetch;
  orderId: string;
}): Promise<AlipayQueryResult> {
  const gatewayUrl = resolveAlipayGatewayUrl();
  const requestParams = buildAlipaySignedRequest({
    method: "alipay.trade.query",
    bizContent: {
      out_trade_no: params.orderId,
    },
  });

  const response = await params.fetchImpl(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(requestParams).toString(),
  });
  const responseText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid Alipay query response: ${responseText}`);
  }

  verifyAlipayResponseSignature(payload);
  const queryResponse = (payload.alipay_trade_query_response ?? {}) as AlipayTradeQueryResponse;
  if (queryResponse.code !== "10000") {
    throw new Error(
      queryResponse.msg
        ? `Alipay query failed: ${queryResponse.msg}`
        : "Alipay query failed with unknown error.",
    );
  }

  const tradeStatus = queryResponse.trade_status;
  return {
    providerSessionId: queryResponse.trade_no,
    paid: tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED",
    metadata: {
      mode: "alipay",
      alipayTradeStatus: tradeStatus,
      alipayTradeNo: queryResponse.trade_no,
      queriedAt: new Date().toISOString(),
    },
  };
}

export function parseAndVerifyAlipayNotification(rawBody: string): AlipayNotificationPayload {
  const notificationParams = parseFormEncodedBody(rawBody);
  const signature = notificationParams.sign;
  if (!signature) {
    throw new Error("Missing Alipay signature.");
  }
  if (!verifyAlipayNotificationSignature(notificationParams)) {
    throw new Error("Alipay notification signature verification failed.");
  }

  const orderId = notificationParams.out_trade_no;
  if (!orderId) {
    throw new Error("Missing Alipay out_trade_no.");
  }

  const tradeStatus = notificationParams.trade_status;
  return {
    orderId,
    providerSessionId: notificationParams.trade_no,
    paid: tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED",
    metadata: {
      mode: "alipay",
      notifyTradeStatus: tradeStatus,
      notifyTradeNo: notificationParams.trade_no,
      notifyAt: new Date().toISOString(),
    },
  };
}

export function resolveAlipayNotifyUrl(): string {
  return (
    normalizeOptionalString(process.env.ALIPAY_NOTIFY_URL) ??
    `${resolveAppBaseUrl()}/api/billing/providers/alipay/notify`
  );
}

function resolveAlipayGatewayUrl(): string {
  return normalizeOptionalString(process.env.ALIPAY_GATEWAY_URL) ?? DEFAULT_ALIPAY_GATEWAY_URL;
}

function buildAlipayGatewayUrl(params: {
  gatewayUrl: string;
  params: Record<string, string>;
}): string {
  return `${params.gatewayUrl}?${new URLSearchParams(params.params).toString()}`;
}

function buildAlipaySignedRequest(params: {
  method: string;
  bizContent: Record<string, unknown>;
  notifyUrl?: string;
  returnUrl?: string;
}): Record<string, string> {
  const requestParams: Record<string, string> = {
    app_id: requireEnv("ALIPAY_APP_ID"),
    method: params.method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatAlipayTimestamp(new Date()),
    version: "1.0",
    biz_content: JSON.stringify(params.bizContent),
  };

  if (params.notifyUrl) {
    requestParams.notify_url = params.notifyUrl;
  }
  if (params.returnUrl) {
    requestParams.return_url = params.returnUrl;
  }

  requestParams.sign = signAlipayParameters(requestParams);
  return requestParams;
}

function signAlipayParameters(params: Record<string, string>): string {
  const privateKey = loadPemKeyFromEnv("ALIPAY_APP_PRIVATE_KEY", "private");
  const content = buildAlipaySignContent(params);
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyAlipayNotificationSignature(params: Record<string, string>): boolean {
  const signature = params.sign;
  if (!signature) {
    return false;
  }
  const publicKey = loadPemKeyFromEnv("ALIPAY_ALIPAY_PUBLIC_KEY", "public");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(buildAlipaySignContent(params), "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function verifyAlipayResponseSignature(payload: Record<string, unknown>): void {
  const responseSign = typeof payload.sign === "string" ? payload.sign : undefined;
  if (!responseSign) {
    return;
  }

  const rootKey = Object.keys(payload).find((key) => key.endsWith("_response"));
  if (!rootKey) {
    return;
  }

  const responseValue = payload[rootKey];
  if (!responseValue || typeof responseValue !== "object" || Array.isArray(responseValue)) {
    throw new Error("Invalid Alipay response payload.");
  }

  const content = JSON.stringify(responseValue);
  const publicKey = loadPemKeyFromEnv("ALIPAY_ALIPAY_PUBLIC_KEY", "public");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  verifier.end();
  const valid = verifier.verify(publicKey, responseSign, "base64");
  if (!valid) {
    throw new Error("Alipay response signature verification failed.");
  }
}

function buildAlipaySignContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null && value !== "";
    })
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function formatAmountYuan(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function formatAlipayTimestamp(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  const seconds = `${value.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function parseFormEncodedBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

function loadPemKeyFromEnv(envName: string, type: "private" | "public"): KeyObject {
  const rawValue = requireEnv(envName);
  const normalizedPem = rawValue.includes("-----BEGIN")
    ? rawValue.replace(/\\n/g, "\n")
    : rawValue;
  return type === "private"
    ? createPrivateKey(normalizedPem)
    : createPublicKey(normalizedPem);
}

function requireEnv(name: string): string {
  const value = normalizeOptionalString(process.env[name]);
  if (!value) {
    throw new Error(`${name} is required for Alipay configuration.`);
  }
  return value;
}
