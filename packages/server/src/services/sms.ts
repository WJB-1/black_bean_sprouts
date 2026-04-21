/**
 * SMS verification service — MVP uses in-memory store.
 * For production: swap with Aliyun/Tencent SMS SDK.
 */

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CODE_LENGTH = 6;

interface StoredCode {
  code: string;
  expiresAt: number;
}

const store = new Map<string, StoredCode>();

function generateDigits(): string {
  const digits: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    digits.push(String(Math.floor(Math.random() * 10)));
  }
  return digits.join("");
}

export function sendCode(phone: string): void {
  // In production: call SMS provider API here
  const code = generateDigits();
  store.set(phone, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  // MVP: log to console for development
  console.log(`[SMS] ${phone}: ${code}`);
}

export function verifyCode(phone: string, inputCode: string): boolean {
  const stored = store.get(phone);
  if (!stored) return false;

  if (Date.now() > stored.expiresAt) {
    store.delete(phone);
    return false;
  }

  if (stored.code !== inputCode) return false;

  // Code is single-use
  store.delete(phone);
  return true;
}
