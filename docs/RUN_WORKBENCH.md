# Workbench 启动与冒烟测试

## 当前默认方案

- 现在最稳的工作台 AI 通路是 `siliconflow-direct`
- `OpenClaw` 保留为参考/后续接入路径，但不再阻塞当前可用版本
- 前端入口是 `http://localhost:5173/workbench`
- 后端默认端口是 `3000`

## 1. 安装依赖

```powershell
pnpm install
pnpm db:generate
```

如果你要测试登录、账单、文档持久化，先把本地基础设施拉起来：

```powershell
docker compose up -d postgres redis minio
pnpm db:push
```

推荐环境：

- Node `24.14.0`（`20+` 也可）
- pnpm `9+`

## 2. 准备环境变量

先复制环境文件：

```powershell
Copy-Item .env.example .env
```

最小可用配置：

```dotenv
WORKBENCH_PROMPT_PROVIDER=siliconflow-direct
SILICONFLOW_API_KEY=你的硅基流动密钥
SILICONFLOW_MODEL=Qwen/Qwen2.5-7B-Instruct
```

说明：

- 工作台在检测到 `SILICONFLOW_API_KEY` 时会优先走直连 SiliconFlow
- `OPENCLAW_PROJECT_PATH` 默认指向 `../reference_projects/openclaw`
- `OPENCLAW_CONFIG_PATH` 默认是 `.openclaw-runtime/openclaw.json`
- 登录、支付、文档保存依赖 PostgreSQL；如果 `localhost:5432` 没启动，这些接口会失败
- Redis / MinIO 当前不是 Workbench 主流程的阻塞项

如果要改成 OpenAI：

### OpenAI Platform API（通过 OpenClaw）

```dotenv
WORKBENCH_PROMPT_PROVIDER=openclaw
OPENAI_API_KEY=你的 OpenAI API Key
OPENCLAW_PROVIDER=openai
OPENCLAW_MODEL=openai/gpt-5.4
```

### ChatGPT / Codex OAuth（通过 OpenClaw）

先在 OpenClaw 里做一次登录：

```powershell
cd ..\reference_projects\openclaw
pnpm openclaw models auth login --provider openai-codex
```

然后在 `.env` 里设置：

```dotenv
WORKBENCH_PROMPT_PROVIDER=openclaw
OPENCLAW_PROVIDER=openai-codex
OPENCLAW_MODEL=openai-codex/gpt-5.4
```

注意：

- `openai/*` 是 OpenAI Platform API 路径
- `openai-codex/*` 是 ChatGPT / Codex OAuth 路径
- 两条路在 OpenClaw 里是分开的，不要混用

## 3. 本地启动

推荐直接用一键脚本：

```powershell
.\start-workbench.ps1
```

如果你刚刚已经构建过，也可以跳过重复构建：

```powershell
.\start-workbench.ps1 -SkipBuild
```

查看状态：

```powershell
.\status-workbench.ps1
```

关闭：

```powershell
.\stop-workbench.ps1
```

也可以用 `pnpm` 包装命令：

```powershell
pnpm run workbench:start
pnpm run workbench:status
pnpm run workbench:stop
```

脚本行为：

- 自动读取根目录 `.env`
- 若存在 `SILICONFLOW_API_KEY`，默认切到 `siliconflow-direct`
- 默认执行一次 `pnpm build`
- 后台拉起后端 `3000` 和前端 `5173`
- 日志写到 `.tmp/workbench-dev/logs`

## 4. 手动启动

后端：

```powershell
pnpm --filter @black-bean-sprouts/server dev
```

前端：

```powershell
pnpm --filter @black-bean-sprouts/web dev
```

打开：

```text
http://localhost:5173/workbench
```

## 5. 构建检查

```powershell
pnpm build
pnpm typecheck
```

## 6. 本地离线冒烟

这个命令不依赖在线模型，验证导入 / 结构化回退 / 导出链路：

```powershell
pnpm run smoke:workbench
```

## 7. 在线全流程冒烟

PowerShell 示例：

```powershell
$env:WORKBENCH_PROMPT_PROVIDER="siliconflow-direct"
$env:SILICONFLOW_API_KEY="你的硅基流动密钥"
$env:SILICONFLOW_MODEL="Qwen/Qwen2.5-7B-Instruct"
pnpm run smoke:workbench-live
```

通过标准：

- 文本导入成功
- AI 结构化成功且 `degraded=false`
- `.docx` 导出成功
- `.tex` 导出成功
- 导出的 `.docx` 能再次导入

## 8. OpenClaw 现状

- 正式运行目录：`.openclaw-runtime`
- 正式配置文件：`.openclaw-runtime/openclaw.json`
- 参考仓库：`../reference_projects/openclaw`
- 当前 live 主路径仍建议先用 `siliconflow-direct`
