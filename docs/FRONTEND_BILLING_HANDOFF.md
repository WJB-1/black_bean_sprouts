# Frontend Billing Handoff

这份文档只讲支付/订阅这一块，给前端同学或前端 AI 直接接。

## 1. 目标

前端需要完成的链路：

1. 登录拿 token
2. 获取可售 plan 和可用支付方式
3. 用户选择 plan + provider
4. 发起支付
5. 根据支付方式跳转或展示二维码
6. 轮询确认支付结果
7. 支付成功后刷新订阅状态

后端已经提供：

- 开发者模式 `developer`
- Stripe `stripe`
- 支付宝 `alipay`
- 微信支付 Native 扫码 `wechatpay`

## 2. API Base

- 页面入口：`http://localhost:3000/workbench`
- API Base：`http://localhost:3000/api`

所有需要登录的接口都带：

```http
Authorization: Bearer <token>
```

## 3. 核心接口

### 3.1 登录

- `POST /api/auth/login`

请求：

```json
{
  "email": "user@example.com",
  "name": "Test User"
}
```

响应：

```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "Test User",
    "role": "USER"
  }
}
```

### 3.2 获取 plan / provider

- `GET /api/billing/plans`

响应示例：

```json
[
  {
    "id": "starter-monthly",
    "name": "Starter Monthly",
    "description": "Structured generation + DOCX/LaTeX export",
    "amountCents": 990,
    "currency": "cny",
    "interval": "month",
    "accessDays": 30,
    "features": [
      "workbench.generate",
      "workbench.export.docx",
      "workbench.export.latex"
    ],
    "provider": "developer",
    "availableProviders": ["developer", "alipay", "wechatpay"]
  }
]
```

前端使用规则：

- `provider`：后端建议的默认支付方式
- `availableProviders`：当前环境真正可用的支付方式按钮来源
- 不要在前端硬编码“永远有支付宝/微信”

### 3.3 获取我的订阅/订单摘要

- `GET /api/billing/me`

响应示例：

```json
{
  "plans": [],
  "subscriptions": [
    {
      "id": "sub-id",
      "planId": "starter-monthly",
      "planName": "Starter Monthly",
      "status": "ACTIVE",
      "currentPeriodEnd": "2026-05-26T10:00:00.000Z",
      "provider": "ALIPAY"
    }
  ],
  "recentOrders": [
    {
      "id": "order-id",
      "planId": "starter-monthly",
      "planName": "Starter Monthly",
      "amountCents": 990,
      "currency": "cny",
      "status": "PAID",
      "provider": "ALIPAY",
      "createdAt": "2026-04-26T10:00:00.000Z",
      "paidAt": "2026-04-26T10:01:00.000Z"
    }
  ]
}
```

## 4. 发起支付

### 4.1 下单

- `POST /api/billing/checkout`

请求：

```json
{
  "planId": "starter-monthly",
  "provider": "wechatpay",
  "successUrl": "http://localhost:3000/billing/success",
  "cancelUrl": "http://localhost:3000/billing/cancel"
}
```

`provider` 可选值：

- `developer`
- `stripe`
- `alipay`
- `wechatpay`

响应分两类：

#### A. 跳转类

```json
{
  "orderId": "order-id",
  "provider": "alipay",
  "checkoutUrl": "https://openapi.alipay.com/gateway.do?...",
  "providerSessionId": "order-id",
  "status": "PENDING",
  "checkoutKind": "redirect"
}
```

前端动作：

- 直接 `window.location.href = checkoutUrl`

#### B. 二维码类

```json
{
  "orderId": "order-id",
  "provider": "wechatpay",
  "checkoutUrl": "weixin://wxpay/bizpayurl?pr=...",
  "providerSessionId": "order-id",
  "status": "PENDING",
  "checkoutKind": "qr",
  "checkoutPayload": {
    "qrCodeUrl": "weixin://wxpay/bizpayurl?pr=...",
    "scene": "native"
  }
}
```

前端动作：

- 用 `checkoutPayload.qrCodeUrl` 生成二维码
- 显示“已支付？我已完成支付”按钮
- 同时开启轮询确认

## 5. 确认支付

### 5.1 主动确认

- `POST /api/billing/checkout/confirm`

请求：

```json
{
  "orderId": "order-id",
  "providerSessionId": "optional-session-id"
}
```

响应：

```json
{
  "orderId": "order-id",
  "status": "PAID",
  "subscriptionStatus": "ACTIVE"
}
```

也可能返回：

```json
{
  "orderId": "order-id",
  "status": "PENDING"
}
```

### 5.2 前端轮询建议

适用于：

- 微信支付扫码中
- 支付宝跳回页面后
- Stripe 完成后回到站内页面
- 开发者模式下模拟支付完成

推荐轮询：

- 间隔：2~3 秒
- 总时长：60~90 秒
- 成功条件：`status === "PAID"`
- 成功后再调一次 `GET /api/billing/me`

伪代码：

```ts
for (let i = 0; i < 30; i += 1) {
  const result = await confirmCheckout(orderId, providerSessionId);
  if (result.status === "PAID") {
    await refreshBillingMe();
    break;
  }
  await sleep(2000);
}
```

## 6. 各支付方式前端处理

### 6.1 Developer

用途：

- 本地联调
- CI / 冒烟测试
- 不扣真钱

行为：

- `manual` 模式：先下单 `PENDING`，再调用 `/checkout/confirm`
- `instant` 模式：下单直接 `PAID`

前端建议：

- 本地优先用这个
- UI 上明确标记“开发者模式”

### 6.2 Alipay

行为：

- 后端返回跳转 URL
- 用户在支付宝完成支付
- 支付宝会异步回调后端
- 前端仍应轮询 `/checkout/confirm`

前端建议：

- 跳转前保存 `orderId`
- 回跳后自动进入“支付确认中”页面

### 6.3 WeChat Pay

行为：

- 当前是 Native 扫码
- 后端返回 `qrCodeUrl`
- 微信支付异步回调后端
- 前端轮询确认结果

前端建议：

- 二维码弹窗或独立页面
- 显示订单金额、plan 名称、倒计时
- 提供“已支付，刷新状态”按钮

### 6.4 Stripe

行为：

- 后端返回 Checkout URL
- 用户跳转 Stripe 托管页面
- 回站后前端轮询确认

## 7. 服务端回调说明

这两个接口是第三方平台调后端的，前端不用直接调：

- `POST /api/billing/providers/alipay/notify`
- `POST /api/billing/providers/wechatpay/notify`

前端要理解的是：

- 真实支付结果可能先由服务端回调更新
- 然后前端轮询 `/api/billing/checkout/confirm` 才看到 `PAID`

## 8. 推荐页面状态机

建议前端统一做这些状态：

- `idle`
- `creating-order`
- `redirecting`
- `waiting-qr-scan`
- `confirming-payment`
- `paid`
- `failed`
- `timeout`

## 9. 错误处理

后端错误一般格式：

```json
{
  "error": "message"
}
```

前端建议：

- `400`：参数错误 / provider 未启用
- `401`：未登录
- `403`：订单不属于当前用户
- `404`：订单不存在
- `>=500`：统一 toast + 支付失败页

## 10. 最小联调顺序

前端最低优先级顺序：

1. 登录
2. `GET /api/billing/plans`
3. `POST /api/billing/checkout`
4. `POST /api/billing/checkout/confirm`
5. `GET /api/billing/me`

## 11. 本地联调建议

`.env` 推荐先用：

```dotenv
BILLING_PROVIDERS=developer
BILLING_DEFAULT_PROVIDER=developer
BILLING_DEVELOPER_MODE=manual
```

这样前端不需要真实支付环境就能把完整 UI 链路跑通。

## 12. 后端源码入口

- `packages/server/src/routes/billing/index.ts`
- `packages/server/src/services/billing-application.ts`
- `packages/server/src/services/billing-shared.ts`
- `packages/server/src/services/billing-alipay.ts`
- `packages/server/src/services/billing-wechatpay.ts`
- `scripts/smoke/billing.mjs`
