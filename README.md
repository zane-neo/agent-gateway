# Agent Gateway

Claude Code 长程运行观测后端：

- OpenTelemetry Collector 接收 OTLP metrics、logs 和 traces。
- ClickHouse 保存完整遥测事件、指标与 trace。
- PostgreSQL 保存每个 Agent run 的当前状态。
- 后台 projector 将 Claude Code 事件投影为可直接查询的运行状态。
- Fastify API 提供运行列表、详情、时间线和汇总统计。

## 启动

项目同时支持 Docker Desktop 和 Finch。默认自动选择可用的运行时：

```bash
cp .env.example .env
make runtime
make up
```

也可以显式指定：

```bash
make up RUNTIME=docker
make up RUNTIME=finch
```

Finch 首次使用需要初始化 VM：

```bash
brew install --cask finch
make init RUNTIME=finch
finch vm status
make up RUNTIME=finch
```

等待 `finch vm status` 显示 VM 正常运行后再执行 `make up`。如果初始化过程尚未结束，
Finch 可能暂时返回 `unrecognized system status`。

常用命令：

```bash
make ps
make logs
make down
make config
```

不使用 Makefile 时，也可以直接运行：

```bash
docker compose up --build -d
finch compose up --build -d
```

## API 鉴权

所有 `/api/*` 接口都要求 Bearer token。启动时会根据
`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` upsert 初始用户；数据库仅保存密码哈希
以及 token 的二次哈希，不保存明文密码。

客户端 token 的计算规则：

```text
SHA-256(username + ":" + password)
```

Shell 示例：

```bash
export AG_USERNAME=admin
export AG_PASSWORD='change-this-password'
export AG_TOKEN="$(
  printf '%s:%s' "$AG_USERNAME" "$AG_PASSWORD" |
    shasum -a 256 |
    awk '{print $1}'
)"

curl -H "Authorization: Bearer $AG_TOKEN" \
  http://localhost:8080/api/auth/me
curl -H "Authorization: Bearer $AG_TOKEN" \
  http://localhost:8080/api/runs
curl -H "Authorization: Bearer $AG_TOKEN" \
  http://localhost:8080/api/stats
```

浏览器登录页会用 Web Crypto 在客户端计算相同 token；密码不会发送到服务端。
该 token 是长期密码等价凭证，EC2 部署必须使用 HTTPS，并应立即修改默认密码。

## 配置 Claude Code

在启动 Claude Code 的 shell 中设置：

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_RESOURCE_ATTRIBUTES="service.name=claude-code,deployment.environment=local"

# 可选：记录用户提示词与助手回复的原文（默认 Claude Code 会将其 redact 为 <REDACTED>）
export OTEL_LOG_USER_PROMPTS=1

# 可选：增强 trace
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp

claude
```

默认不开启 prompt、回复正文或工具详细内容，避免把代码和敏感数据写入遥测库。

## 远程控制 Agent（网关托管执行）

除观测外，网关还能直接托管执行 Claude Code：在仪表盘底部输入 prompt 即可，
网关用 Claude Agent SDK 在服务端进程内运行 Agent。

- 网关**不管理凭证**：API key / 登录信息由运行环境提供（`ANTHROPIC_API_KEY`
  等，见 `.env.example`），托管进程直接继承。
- 托管运行会注入 OTel 环境变量，遥测经同一条管道进入 ClickHouse，因此这些会话
  会自动出现在左侧 session 列表里，对话详情实时刷新。
- 提交的 prompt 与最终结果另存于 `agent_prompts` 表，即使没有遥测也可追溯。
- 选中一个由网关托管创建的会话再发送，会以 `resume` 继续该会话；否则新建会话。

```text
POST /api/agent/prompts        { "prompt": "...", "resumeSessionId": "<可选>" }
GET  /api/agent/prompts?limit=50
GET  /api/agent/prompts/:id
```

## API

```text
GET /api/stats
GET /api/runs?status=running&limit=50&cursor=<timestamp>
GET /api/runs/:runId
GET /api/runs/:runId/events?limit=1000&after=<timestamp>
POST /api/agent/prompts
GET /api/agent/prompts
GET /api/agent/prompts/:id
```

## 数据流

```text
Claude Code
  └─ OTLP metrics/logs/traces
       └─ OpenTelemetry Collector
            └─ ClickHouse (otel_logs, otel_traces)
                 └─ projector
                      └─ PostgreSQL (agent_runs)
                           └─ REST API
```

`agent_runs` 是可重建的状态投影；ClickHouse 中的遥测记录是事实来源。

## 当前边界

- 状态推断依赖 Claude Code OTel 属性名称，并兼容常见的 `session.id`、
  `event.name` 和 body JSON 形式。
- OTel 负责观测，不提供 Agent 暂停、恢复或取消；这些能力需要后续增加 Runner
  与控制通道。
- ClickHouse 遥测数据默认保留 30 天，可在 Collector 的 `ttl` 配置中调整。
