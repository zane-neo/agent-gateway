import { createHash } from "node:crypto";
import { toClickHouseDateTime64 } from "./clickhouse-time.js";
import { clickhouse, clickhouseTableExists, postgres } from "./db.js";
import type { ClaudeLogRow, ProjectedEvent, RunStatus } from "./types.js";

const CHECKPOINT = "claude-code-logs";

function first(
  attributes: Record<string, string>,
  resources: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = attributes[key] ?? resources[key];
    if (value) return value;
  }
  return undefined;
}

function numeric(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Collapse a prompt into a short single-line session name. Returns undefined for
// empty/redacted prompts so a real title isn't overwritten by a placeholder.
function summarizeTitle(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined;
  const flat = prompt.replace(/\s+/g, " ").trim();
  if (!flat || flat === "<REDACTED>") return undefined;
  return flat.length > 80 ? `${flat.slice(0, 79)}…` : flat;
}

function parseBody(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { message: body };
  } catch {
    return { message: body };
  }
}

export function projectClaudeEvent(row: ClaudeLogRow): ProjectedEvent | null {
  const body = parseBody(row.body);
  const sessionId =
    first(row.attributes, row.resources, [
      "session.id",
      "session_id",
      "claude_code.session.id"
    ]) ?? (typeof body.session_id === "string" ? body.session_id : undefined);

  if (!sessionId) return null;

  const eventName =
    first(row.attributes, row.resources, [
      "event.name",
      "event_name",
      "claude_code.event.name"
    ]) ??
    (typeof body.event_name === "string" ? body.event_name : undefined) ??
    (typeof body.name === "string" ? body.name : undefined) ??
    "claude_code.unknown";

  let status: RunStatus = "running";
  let waitingReason: string | undefined;

  if (/permission|tool_decision/i.test(eventName)) {
    const decision = first(row.attributes, row.resources, [
      "decision",
      "permission.decision",
      "tool.decision"
    ]);
    if (!decision || /ask|pending/i.test(decision)) {
      status = "waiting_for_permission";
      waitingReason = "permission";
    }
  } else if (/user_input|notification/i.test(eventName)) {
    status = "waiting_for_user";
    waitingReason = "user_input";
  } else if (/error|failed/i.test(eventName)) {
    status = "failed";
  } else if (/session_end|stop|completed/i.test(eventName)) {
    status = "completed";
  }

  const currentTool = first(row.attributes, row.resources, [
    "tool.name",
    "tool_name",
    "gen_ai.tool.name"
  ]);
  const inputTokens = numeric(
    first(row.attributes, row.resources, [
      "input_tokens",
      "gen_ai.usage.input_tokens"
    ])
  );
  const outputTokens = numeric(
    first(row.attributes, row.resources, [
      "output_tokens",
      "gen_ai.usage.output_tokens"
    ])
  );
  const estimatedCostUsd = numeric(
    first(row.attributes, row.resources, [
      "cost_usd",
      "estimated_cost_usd",
      "claude_code.cost.usage"
    ])
  );

  // Derive a human-readable session name from the first user prompt. Telemetry
  // only carries the prompt text when OTEL_LOG_USER_PROMPTS=1 and it isn't
  // redacted; otherwise title stays undefined and the UI falls back to the UUID.
  let title: string | undefined;
  if (/user_prompt/i.test(eventName)) {
    const promptText =
      first(row.attributes, row.resources, ["prompt"]) ??
      (typeof body.prompt === "string" ? body.prompt : undefined) ??
      (typeof body.message === "string" ? body.message : undefined);
    title = summarizeTitle(promptText);
  }

  return {
    sessionId,
    runId: `run_${createHash("sha256").update(sessionId).digest("hex").slice(0, 20)}`,
    timestamp: new Date(row.timestamp),
    eventName,
    status,
    currentTool,
    waitingReason,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    promptIncrement: /user_prompt/i.test(eventName) ? 1 : 0,
    title,
    metadata: {
      traceId: row.traceId,
      spanId: row.spanId
    }
  };
}

async function checkpoint(): Promise<Date> {
  const result = await postgres.query<{ cursor_timestamp: Date }>(
    "SELECT cursor_timestamp FROM projection_checkpoints WHERE projector = $1",
    [CHECKPOINT]
  );
  return result.rows[0]?.cursor_timestamp ?? new Date(0);
}

async function loadLogs(cursor: Date): Promise<ClaudeLogRow[]> {
  if (!(await clickhouseTableExists("otel_logs"))) {
    return [];
  }
  const result = await clickhouse.query({
    query: `
      SELECT
        formatDateTime(Timestamp, '%FT%T.%fZ', 'UTC') AS timestamp,
        TraceId AS traceId,
        SpanId AS spanId,
        Body AS body,
        LogAttributes AS attributes,
        ResourceAttributes AS resources
      FROM otel_logs
      WHERE Timestamp > {cursor:DateTime64(9)}
        AND (
          ServiceName = 'claude-code'
          OR mapContains(ResourceAttributes, 'service.name')
          OR Body ILIKE '%claude_code%'
        )
      ORDER BY Timestamp ASC
      LIMIT 5000
    `,
    query_params: { cursor: toClickHouseDateTime64(cursor) },
    format: "JSONEachRow"
  });
  return result.json<ClaudeLogRow>();
}

async function saveEvent(event: ProjectedEvent): Promise<void> {
  const terminal = event.status === "completed" || event.status === "failed";
  await postgres.query(
    `
      INSERT INTO agent_runs (
        run_id, session_id, status, started_at, last_event_at, ended_at,
        current_event, current_tool, waiting_reason, prompt_count,
        input_tokens, output_tokens, estimated_cost_usd, title, metadata
      )
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (session_id) DO UPDATE SET
        status = EXCLUDED.status,
        last_event_at = GREATEST(agent_runs.last_event_at, EXCLUDED.last_event_at),
        ended_at = COALESCE(EXCLUDED.ended_at, agent_runs.ended_at),
        current_event = EXCLUDED.current_event,
        current_tool = COALESCE(EXCLUDED.current_tool, agent_runs.current_tool),
        waiting_reason = EXCLUDED.waiting_reason,
        prompt_count = agent_runs.prompt_count + EXCLUDED.prompt_count,
        input_tokens = agent_runs.input_tokens + EXCLUDED.input_tokens,
        output_tokens = agent_runs.output_tokens + EXCLUDED.output_tokens,
        estimated_cost_usd = agent_runs.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
        -- First prompt to arrive names the session; later events keep it.
        title = COALESCE(agent_runs.title, EXCLUDED.title),
        metadata = agent_runs.metadata || EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      event.runId,
      event.sessionId,
      event.status,
      event.timestamp,
      terminal ? event.timestamp : null,
      event.eventName,
      event.currentTool ?? null,
      event.waitingReason ?? null,
      event.promptIncrement,
      event.inputTokens,
      event.outputTokens,
      event.estimatedCostUsd,
      event.title ?? null,
      JSON.stringify(event.metadata)
    ]
  );
}

export async function projectOnce(): Promise<number> {
  const cursor = await checkpoint();
  const rows = await loadLogs(cursor);
  let latest = cursor;
  let projected = 0;

  for (const row of rows) {
    const timestamp = new Date(row.timestamp);
    if (timestamp > latest) latest = timestamp;
    const event = projectClaudeEvent(row);
    if (!event) continue;
    await saveEvent(event);
    projected += 1;
  }

  if (latest > cursor) {
    await postgres.query(
      `
        UPDATE projection_checkpoints
        SET cursor_timestamp = $2, updated_at = now()
        WHERE projector = $1
      `,
      [CHECKPOINT, latest]
    );
  }

  return projected;
}
