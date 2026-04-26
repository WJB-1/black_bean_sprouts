import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomUUID,
  type KeyObject,
} from "node:crypto";
import type { BillingPlan } from "./billing-shared.js";
import { normalizeOptionalString, resolveAppBaseUrl } from "./billing-shared.js";

export type WeChatPayCheckoutPreparation = {
  readonly checkoutUrl: string;
  readonly providerSessionId: string;
  readonly checkoutPayload: Record<string, unknown>;
};

export type WeChatPayQueryResult = {
  readonly providerSessionId?: string;
  readonly providerSubscriptionId?: string;
  readonly paid: boolean;
  readonly metadata: Record<string, unknown>;
};

export type WeChatPayNotificationPayload = {
  readonly orderId: string;
  readonly providerSessionId?: string;
  readonly paid: boolean;
  readonly metadata: Record<string, unknown>;
};

type WeChatPayNativeOrderResponse = {
  code_url?: string;
};

type WeChatPayQueryResponse = {
  trade_state?: string;
  transaction_id?: string;
};

type WeChatPayNotificationEnvelope = {
  event_type?: string;
  resource?: {
    algorithm?: string;
    ciphertext?: string;
    associated_data?: string;
    nonce?: string;
  };
};

type WeChatPayNotificationResourcePayload = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
};

const WECHAT_PAY_BASE_URL = "https://api.mch.weixin.qq.com";

export async function prepareWeChatPayCheckout(params: {
  fetchImpl: typeof fetch;
  plan: BillingPlan;
  orderId: string;
}): Promise<WeChatPayCheckoutPreparation> {
  if (params.plan.currency.toLowerCase() !== "cny") {
    throw new Error("WeChat Pay currently supports only CNY-denominated plans.");
  }

  const body = JSON.stringify({
    appid: requireEnv("WECHAT_PAY_APP_ID"),
    mchid: requireEnv("WECHAT_PAY_MCH_ID"),
    description: params.plan.name,
    out_trade_no: params.orderId,
    notify_url: resolveWeChatPayNotifyUrl(),
    amount: {
      total: params.plan.amountCents,
      currency: "CNY",
    },
  });

  const response = await performWeChatPayRequest({
    fetchImpl: params.fetchImpl,
    method: "POST",
    path: "/v3/pay/transactions/native",
    body,
  });

  const payload = parseJsonText<WeChatPayNativeOrderResponse>(response.bodyText);
  if (!payload.code_url) {
    throw new Error("WeChat Pay did not return a code_url for Native payment.");
  }

  return {
    checkoutUrl: payload.code_url,
    providerSessionId: params.orderId,
    checkoutPayload: {
      qrCodeUrl: payload.code_url,
      scene: "native",
      note: "Render this code_url as a QR code for the user to scan in WeChat.",
    },
  };
}

export async function queryWeChatPayOrder(params: {
  fetchImpl: typeof fetch;
  orderId: string;
}): Promise<WeChatPayQueryResult> {
  const mchid = requireEnv("WECHAT_PAY_MCH_ID");
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(params.orderId)}?mchid=${encodeURIComponent(mchid)}`;
  const response = await performWeChatPayRequest({
    fetchImpl: params.fetchImpl,
    method: "GET",
    path,
  });
  const payload = parseJsonText<WeChatPayQueryResponse>(response.bodyText);
  return {
    providerSessionId: payload.transaction_id,
    paid: payload.trade_state === "SUCCESS",
    metadata: {
      mode: "wechatpay",
      wechatPayTradeState: payload.trade_state,
      wechatPayTransactionId: payload.transaction_id,
      queriedAt: new Date().toISOString(),
    },
  };
}

export function parseAndVerifyWeChatPayNotification(params: {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawBody: string;
}): WeChatPayNotificationPayload {
  verifyWeChatPayNotificationSignature(params.headers, params.rawBody);
  const envelope = parseJsonText<WeChatPayNotificationEnvelope>(params.rawBody);
  const resource = envelope.resource;
  if (!resource) {
    throw new Error("Missing WeChat Pay notification resource.");
  }

  const decrypted = decryptWeChatPayNotificationResource(resource);
  if (!decrypted.out_trade_no) {
    throw new Error("Missing WeChat Pay out_trade_no.");
  }

  return {
    orderId: decrypted.out_trade_no,
    providerSessionId: decrypted.transaction_id,
    paid: decrypted.trade_state === "SUCCESS",
    metadata: {
      mode: "wechatpay",
      notifyEventType: envelope.event_type,
      notifyAt: new Date().toISOString(),
      wechatPayTradeState: decrypted.trade_state,
      wechatPayTransactionId: decrypted.transaction_id,
    },
  };
}

export function resolveWeChatPayNotifyUrl(): string {
  return (
    normalizeOptionalString(process.env.WECHAT_PAY_NOTIFY_URL) ??
    `${resolveAppBaseUrl()}/api/billing/providers/wechatpay/notify`
  );
}

async function performWeChatPayRequest(params: {
  fetchImpl: typeof fetch;
  method: "GET" | "POST";
  path: string;
  body?: string;
}) {
  const headers = buildWeChatPayRequestHeaders(params.method, params.path, params.body ?? "");
  const response = await params.fetchImpl(`${WECHAT_PAY_BASE_URL}${params.path}`, {
    method: params.method,
    headers,
    body: params.body,
  });
  const bodyText = await response.text();
  maybeVerifyWeChatPayResponseSignature(response.headers, bodyText);
  if (!response.ok) {
    throw new Error(`WeChat Pay request failed with status ${response.status}: ${bodyText}`);
  }
  return {
    bodyText,
  };
}

function buildWeChatPayRequestHeaders(
  method: "GET" | "POST",
  path: string,
  body: string,
): Record<string, string> {
  const mchid = requireEnv("WECHAT_PAY_MCH_ID");
  const serialNo = requireEnv("WECHAT_PAY_MCH_SERIAL_NO");
  const privateKey = loadPemKeyFromEnv("WECHAT_PAY_PRIVATE_KEY", "private");
  const nonce = randomUUID().replace(/-/g, "");
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  const signature = signer.sign(privateKey, "base64");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
    "User-Agent": "black-bean-sprouts/1.0",
  };
}

function verifyWeChatPayNotificationSignature(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  rawBody: string,
): void {
  const signature = getHeaderValue(headers, "wechatpay-signature");
  const nonce = getHeaderValue(headers, "wechatpay-nonce");
  const timestamp = getHeaderValue(headers, "wechatpay-timestamp");
  const serial = getHeaderValue(headers, "wechatpay-serial");

  if (!signature || !nonce || !timestamp || !serial) {
    throw new Error("Missing WeChat Pay signature headers.");
  }

  const expectedSerial = normalizeOptionalString(process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL);
  if (expectedSerial && expectedSerial !== serial) {
    throw new Error("WeChat Pay platform certificate serial mismatch.");
  }

  const certificate = loadPemKeyFromEnv("WECHAT_PAY_PLATFORM_CERT", "public");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`, "utf8");
  verifier.end();
  const valid = verifier.verify(certificate, signature, "base64");
  if (!valid) {
    throw new Error("WeChat Pay notification signature verification failed.");
  }
}

function maybeVerifyWeChatPayResponseSignature(headers: Headers, bodyText: string): void {
  const certValue = normalizeOptionalString(process.env.WECHAT_PAY_PLATFORM_CERT);
  if (!certValue) {
    return;
  }

  const signature = headers.get("wechatpay-signature");
  const nonce = headers.get("wechatpay-nonce");
  const timestamp = headers.get("wechatpay-timestamp");
  const serial = headers.get("wechatpay-serial");

  if (!signature || !nonce || !timestamp || !serial) {
    return;
  }

  const expectedSerial = normalizeOptionalString(process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL);
  if (expectedSerial && expectedSerial !== serial) {
    throw new Error("WeChat Pay response certificate serial mismatch.");
  }

  const certificate = loadPemKeyFromEnv("WECHAT_PAY_PLATFORM_CERT", "public");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${bodyText}\n`, "utf8");
  verifier.end();
  const valid = verifier.verify(certificate, signature, "base64");
  if (!valid) {
    throw new Error("WeChat Pay response signature verification failed.");
  }
}

function decryptWeChatPayNotificationResource(
  resource: NonNullable<WeChatPayNotificationEnvelope["resource"]>,
): WeChatPayNotificationResourcePayload {
  if (
    resource.algorithm !== "AEAD_AES_256_GCM" ||
    !resource.ciphertext ||
    !resource.nonce
  ) {
    throw new Error("Unsupported WeChat Pay notification resource.");
  }

  const apiV3Key = requireEnv("WECHAT_PAY_API_V3_KEY");
  if (apiV3Key.length !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be 32 bytes.");
  }

  const encrypted = Buffer.from(resource.ciphertext, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiV3Key, "utf8"),
    Buffer.from(resource.nonce, "utf8"),
  );
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return parseJsonText<WeChatPayNotificationResourcePayload>(plaintext);
}

function parseJsonText<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function getHeaderValue(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  key: string,
): string | undefined {
  const direct = headers[key];
  if (typeof direct === "string") {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct[0];
  }

  const normalizedKey = key.toLowerCase();
  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() !== normalizedKey) {
      continue;
    }
    if (typeof headerValue === "string") {
      return headerValue;
    }
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
  }
  return undefined;
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
    throw new Error(`${name} is required for WeChat Pay configuration.`);
  }
  return value;
}
