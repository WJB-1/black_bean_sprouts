# Frontend API Handoff

这份文档是给前端同学和前端 AI 的直接交接文档。

如果你要接这个项目的前端，请先读这份，再看源码。

## 1. 当前推荐接入范围

当前最稳定、最适合优先接入的是 Workbench 流程：

1. 登录拿 token（开发态可选）
2. 获取排版预设
3. 导入原始文本或 DOCX
4. 调 AI 结构化生成 `Doc` AST
5. 导出 DOCX / LaTeX

如果只是先把“未整理文稿 -> 整理后文档导出”跑通，优先只接这几个接口：

- `POST /api/auth/login`
- `GET /api/workbench/style-profiles`
- `POST /api/workbench/import`
- `POST /api/workbench/generate`
- `POST /api/workbench/export`

## 2. 本地服务地址

- 页面入口：`http://localhost:3000/workbench`
- API 基址：`http://localhost:3000/api`

注意：

- 当前前端静态资源由后端直接托管
- 不需要再单独假定 Vite 开发服务器一定存在

## 3. 鉴权规则

### 3.1 登录

开发态登录接口：

- `POST /api/auth/login`

请求体：

```json
{
  "email": "user@example.com"
}
```

响应体：

```json
{
  "token": "jwt-token",
  "user": {
    "email": "user@example.com",
    "role": "USER"
  }
}
```

说明：

- `email` 里包含 `admin` 时，后端会给 `ADMIN`
- 否则给 `USER`
- 这是开发态登录，不是正式账号体系

### 3.2 Bearer Token

需要登录的接口统一按下面方式带：

```http
Authorization: Bearer <token>
```

### 3.3 当前哪些接口必须带 token

明确需要：

- `/api/admin/*`
- `/api/documents/:id/render`
- `/api/render-jobs/:id`
- `/api/render-jobs/:id/download`

当前 Workbench 相关接口默认不要求登录。

## 4. 核心数据结构

## 4.1 `Doc` AST

Workbench 的生成结果、编辑器的数据结构、导出接口的输入，核心都是 `Doc`。

最小结构：

```json
{
  "version": 0,
  "metadata": {
    "title": "文档标题",
    "subtitle": "可选副标题",
    "institution": "可选机构",
    "keywords": ["关键词1", "关键词2"],
    "authors": [
      {
        "name": "作者名",
        "affiliation": "单位"
      }
    ]
  },
  "children": []
}
```

块级节点 `children` 支持：

- `paragraph`
- `heading`
- `figure`
- `table`
- `formula`
- `reference-list`
- `abstract`
- `section`

行内节点支持：

- `text`
- `hardBreak`
- `citation`
- `xref`
- `formula-inline`

最小段落示例：

```json
{
  "type": "paragraph",
  "id": "p-1",
  "children": [
    {
      "type": "text",
      "text": "这是一段正文。"
    }
  ]
}
```

最小标题示例：

```json
{
  "type": "heading",
  "id": "h-1",
  "level": 1,
  "children": [
    {
      "type": "text",
      "text": "研究背景"
    }
  ]
}
```

`Doc` 的源码定义：

- `packages/doc-schema/src/doc/types.ts`

## 4.2 `DocumentPatchBatch`

如果前端要做“结构化编辑器”，应通过 patch 接口修改文档，而不是整份覆盖写回。

结构：

```json
{
  "expectedVersion": 3,
  "source": "user",
  "patches": [
    {
      "op": "updateMetadata",
      "metadata": {
        "title": "新的标题"
      }
    }
  ]
}
```

`source` 取值：

- `user`
- `agent`
- `system`

常见 patch 操作：

- `insert`
- `remove`
- `move`
- `replace`
- `updateMetadata`
- `insertInline`
- `removeInline`
- `replaceInline`
- `insertTableRow`
- `removeTableRow`
- `replaceTableCell`
- `addReference`
- `removeReference`
- `updateReference`

源码定义：

- `packages/doc-schema/src/patch/types.ts`
- `packages/doc-schema/src/patch/batch.ts`

## 5. Workbench 接口

## 5.1 获取排版预设

- `GET /api/workbench/style-profiles`

响应示例：

```json
[
  {
    "id": "default",
    "name": "学术经典",
    "description": "适合常见论文与报告的通用排版。",
    "defaults": {
      "bodyFontSizePt": 12,
      "lineSpacing": 1.5,
      "marginTopMm": 25,
      "marginBottomMm": 25,
      "marginLeftMm": 30,
      "marginRightMm": 25
    }
  }
]
```

用途：

- 初始化导出设置面板
- 让用户选预设后再微调

## 5.2 导入原始文件

- `POST /api/workbench/import`

请求体：

```json
{
  "fileName": "draft.docx",
  "contentBase64": "base64-encoded-content"
}
```

说明：

- 支持文本类文件和 `.docx`
- `contentBase64` 必须是纯 base64 字符串
- 请求体大小上限 25MB

响应体：

```json
{
  "rawText": "提取后的正文……",
  "title": "可选标题",
  "sourceType": "docx"
}
```

## 5.3 结构化生成

- `POST /api/workbench/generate`

请求体：

```json
{
  "rawText": "原始草稿全文……",
  "title": "可选备用标题"
}
```

响应体：

```json
{
  "doc": {
    "version": 0,
    "metadata": {
      "title": "整理后的标题"
    },
    "children": []
  },
  "degraded": false,
  "warning": "可选警告",
  "modelOutput": "模型原始输出"
}
```

说明：

- `doc` 是后续导出的直接输入
- `degraded=true` 表示 AI 结构化失败，后端已回退成段落导入
- 前端应展示 `warning`

## 5.4 导出文档

- `POST /api/workbench/export`

请求体：

```json
{
  "doc": {
    "version": 0,
    "metadata": {
      "title": "示例标题"
    },
    "children": []
  },
  "format": "docx",
  "style": {
    "styleProfileId": "default",
    "bodyFontSizePt": 12,
    "lineSpacing": 1.5,
    "marginTopMm": 25,
    "marginBottomMm": 25,
    "marginLeftMm": 30,
    "marginRightMm": 25
  }
}
```

`format` 当前支持：

- `docx`
- `latex`

注意：

- 这个接口返回的是文件二进制，不是 JSON
- 需要以前端 `blob` 方式下载
- 响应头里会有 `Content-Type` 和 `Content-Disposition`

浏览器侧推荐写法：

```ts
const response = await fetch("/api/workbench/export", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  throw new Error(await response.text());
}

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "document.docx";
link.click();
URL.revokeObjectURL(url);
```

## 6. 编辑器/文档接口

如果前端要接结构化编辑器，需要继续接下面两个。

## 6.1 获取文档

- `GET /api/documents/:id`

响应体：

```json
{
  "id": "document-id",
  "version": 3,
  "content": {
    "version": 3,
    "metadata": {
      "title": "标题"
    },
    "children": []
  }
}
```

## 6.2 提交 patch

- `PATCH /api/documents/:id/patches`

请求体是 `DocumentPatchBatch`。

成功响应：

```json
{
  "ok": true,
  "version": 4
}
```

版本冲突响应：

```json
{
  "error": "Version conflict: expected 3, but current is 4",
  "currentVersion": 4
}
```

前端处理建议：

- 收到 `409` 时先重新拉取最新文档
- 再提示用户重试或做冲突处理

## 7. Agent 接口

## 7.1 对话

- `POST /api/agent/chat`

请求体：

```json
{
  "message": "请帮我总结这篇文稿",
  "sessionId": "可选",
  "sessionKey": "可选",
  "documentId": "可选"
}
```

响应体：

```json
{
  "reply": "最终回复文本",
  "events": []
}
```

说明：

- 当前是一次性返回，不是 SSE
- `events` 里是运行事件列表，前端可用于调试或高级交互

## 8. 异步渲染接口

这组接口用于把已保存文档交给异步渲染系统处理，不是 Workbench 主链路。

## 8.1 提交渲染任务

- `POST /api/documents/:id/render`

请求体：

```json
{
  "format": "docx"
}
```

支持格式：

- `docx`
- `pdf`

需要登录。

## 8.2 查询渲染任务状态

- `GET /api/render-jobs/:id`

需要登录。

## 8.3 获取下载地址

- `GET /api/render-jobs/:id/download`

需要登录。

响应体：

```json
{
  "url": "signed-download-url"
}
```

## 9. Billing 接口

这组接口给产品订阅/支付页用。

## 9.1 获取可售计划

- `GET /api/billing/plans`

响应示例：

```json
[
  {
    "id": "starter-monthly",
    "name": "Starter Monthly",
    "description": "Structured generation + DOCX/LaTeX export",
    "amountCents": 990,
    "currency": "usd",
    "interval": "month",
    "accessDays": 30,
    "features": [
      "workbench.generate",
      "workbench.export.docx",
      "workbench.export.latex"
    ],
    "provider": "mock"
  }
]
```

## 9.2 获取当前用户账单摘要

- `GET /api/billing/me`

需要登录。

响应体包含：

- `plans`
- `subscriptions`
- `recentOrders`

## 9.3 创建结账会话

- `POST /api/billing/checkout`

需要登录。

请求体：

```json
{
  "planId": "starter-monthly",
  "successUrl": "http://localhost:3000/billing/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "http://localhost:3000/billing/cancel"
}
```

响应示例：

```json
{
  "orderId": "order-id",
  "provider": "stripe",
  "checkoutUrl": "https://checkout.stripe.com/...",
  "providerSessionId": "cs_test_...",
  "status": "PENDING"
}
```

前端动作：

- 直接跳转到 `checkoutUrl`

## 9.4 支付成功后确认订单

- `POST /api/billing/checkout/confirm`

需要登录。

请求体：

```json
{
  "orderId": "order-id",
  "providerSessionId": "cs_test_..."
}
```

响应示例：

```json
{
  "orderId": "order-id",
  "status": "PAID",
  "subscriptionStatus": "ACTIVE"
}
```

说明：

- 当前支持 `mock` 和 `stripe`
- 本地未配置 Stripe 时，默认走 `mock`
- 前端可以先接完整流程，不必等真实支付环境

## 10. 管理后台接口

管理接口统一在：

- `/api/admin/style-profiles`
- `/api/admin/doc-types`
- `/api/admin/skills`

都是管理员接口，需要 `ADMIN` token。

支持的操作模式：

- `GET` 列表
- `POST` 新建
- `PUT /:id` 更新
- `PATCH /:id/toggle` 启停

源码入口：

- `packages/server/src/routes/admin/index.ts`

## 11. 错误处理约定

大多数接口错误格式是：

```json
{
  "error": "错误信息"
}
```

部分校验错误会附带：

```json
{
  "error": "Invalid document AST",
  "details": [
    "..."
  ]
}
```

前端建议：

- 先尝试解析 JSON
- 若不是 JSON，再按纯文本错误处理

## 12. 当前前端接入建议

如果你是前端 AI，请按下面顺序工作：

1. 只先接 Workbench
2. 导出接口按二进制下载处理
3. 把 `Doc` 视为单一事实来源
4. 若做编辑器，再接 `DocumentPatchBatch`
5. 不要自己发明另一套富文本数据结构

## 13. 后端源码入口

优先看这些文件：

- `packages/server/src/index.ts`
- `packages/server/src/plugins/auth.ts`
- `packages/server/src/routes/workbench/index.ts`
- `packages/server/src/routes/document/patches.ts`
- `packages/server/src/routes/document/render.ts`
- `packages/server/src/routes/render-job/index.ts`
- `packages/server/src/routes/billing/index.ts`
- `packages/server/src/routes/agent/index.ts`
- `packages/server/src/routes/admin/index.ts`
- `packages/server/src/services/billing-application.ts`
- `packages/doc-schema/src/doc/types.ts`
- `packages/doc-schema/src/patch/types.ts`
- `packages/doc-schema/src/patch/batch.ts`

## 14. 一句话总结

当前前端最应该接的是：

`login -> style-profiles -> import -> generate -> export`

如果只想尽快把产品跑起来，请先把这条链路做好。
