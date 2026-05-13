# Local Claude 开发记录与排障

这份记录只针对本仓库的本地开发链路。不要把这里的设置写到系统级 Claude、全局 npm、全局 pnpm 或全局 shell 配置里。

## 当前约束

- Claude Code npm 程序必须安装在 `.claude-runtime/npm/`。
- Claude HOME 必须指向 `.claude-runtime/home/`。
- DOCX MCP 必须安装在 `.claude-runtime/mcp/`。
- API key 只放本地 `.env`，不要提交。
- Docker 不是 Workbench AI/Claude 链路的必需项，调试这个链路时先不要引入 Docker 变量。

## 必须使用的局部环境

后端启动时会读取 `.env`，并在 Claude 子进程里设置：

```bash
HOME=$PWD/.claude-runtime/home
XDG_CONFIG_HOME=$PWD/.claude-runtime/home/.config
ANTHROPIC_BASE_URL=$CLAUDE_CODE_BASE_URL
ANTHROPIC_AUTH_TOKEN=$DEEPSEEK_API_KEY
BBS_DOCX_MCP_ENTRY=$PWD/.claude-runtime/mcp/node_modules/@docx-mcp/docx-mcp/dist/index.js
BBS_DOCX_OUTPUT_DIR=$PWD/.tmp/docx-mcp-output
```

如果 Claude 返回 `Not logged in · Please run /login`，优先检查 `.env` 里是否有 `DEEPSEEK_API_KEY`、`CLAUDE_CODE_BASE_URL`，以及后端是否是从仓库根目录读取 `.env` 启动的。不要去改 `~/.claude`。

## 超时与进度

旧问题：前端假进度条会在 Claude 实际无响应时继续动，最后只看到 `Claude Code timed out after 120000ms`。

现在处理方式：

- 默认 Claude 子进程超时改为 `300000ms`。
- 后端提供流式接口 `POST /api/workbench/generate/stream`，返回 NDJSON 进度。
- 后端提供任务接口：
  - `POST /api/workbench/generate/jobs`
  - `GET /api/workbench/generate/jobs/:jobId`
  - `DELETE /api/workbench/generate/jobs/:jobId`
- 前端“一键整理”默认走任务接口轮询，页面会显示 Claude 启动、heartbeat、解析和校验状态。
- Claude 子进程每 10 秒发一次 heartbeat：`Claude 仍在运行：Xs / 300s`。

如果页面长时间停在“正在调用 AI”，用 `GET /api/workbench/generate/jobs/:jobId` 查状态。只要 `updatedAt` 在变化或 message 有 heartbeat，就说明后端仍在等 Claude。

## 端口残留

`tsx watch` 在频繁重启时容易留下占用 `3000` 的 node 进程，导致新后端启动失败：

```text
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

排查：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

开发 Claude 链路时，优先用非 watch 后端启动，减少残留：

```bash
bash -lc 'set -a; source .env; set +a; exec packages/server/node_modules/.bin/tsx packages/server/src/index.ts'
```

如果必须杀旧进程，只杀 `lsof` 查出来的本项目 node 进程，不要批量杀全局 node。

## 代理与网络

GitHub 或 npm 下载慢/失败时，优先确认本机代理是否可用。当前常用代理地址：

```bash
http_proxy=http://127.0.0.1:7890
https_proxy=http://127.0.0.1:7890
```

访问本地后端时要去掉代理，避免本地请求走代理：

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY curl http://127.0.0.1:3000/api/workbench/style-profiles
```

## 冒烟顺序

1. `npm run setup:local`
2. `npm run setup:claude-code`
3. `npm run setup:docx-mcp`
4. `claude mcp list` 必须显示 `word-docx ... Connected`，且使用局部 `HOME`。
5. 启动后端和前端。
6. 调 `POST /api/workbench/generate/jobs`，确认能拿到 `running`。
7. 轮询 `GET /api/workbench/generate/jobs/:jobId`，确认进度会更新。
8. 测 `POST /api/workbench/generate-docx`，确认返回 `.docx`。

提交前必须检查：

```bash
rg -n "sk-|DEEPSEEK_API_KEY|ANTHROPIC_AUTH_TOKEN" -S .
git status --short
```

`.env`、`.claude-runtime/`、`.tmp/`、`node_modules/` 不应进入提交。
