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
- Redis / MinIO 当前不是 Workbench 主流程的阻塞项

## 3. 本地启动

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

## 4. 构建检查

```powershell
pnpm build
pnpm typecheck
```

## 5. 本地离线冒烟

这个命令不依赖在线模型，验证导入 / 结构化回退 / 导出链路：

```powershell
pnpm run smoke:workbench
```

## 6. 在线全流程冒烟

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

## 7. OpenClaw 现状

- 正式运行目录：`.openclaw-runtime`
- 正式配置文件：`.openclaw-runtime/openclaw.json`
- 参考仓库：`../reference_projects/openclaw`
- 当前 live 主路径仍建议先用 `siliconflow-direct`
