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

验证：

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/runs
curl http://localhost:8080/api/stats
```

## 配置 Claude Code

在启动 Claude Code 的 shell 中设置：

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_RESOURCE_ATTRIBUTES="service.name=claude-code,deployment.environment=local"

# 可选：增强 trace
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1
export OTEL_TRACES_EXPORTER=otlp

claude
```

默认不开启 prompt、回复正文或工具详细内容，避免把代码和敏感数据写入遥测库。

## API

```text
GET /health
GET /api/stats
GET /api/runs?status=running&limit=50&cursor=<timestamp>
GET /api/runs/:runId
GET /api/runs/:runId/events?limit=200&before=<timestamp>
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
