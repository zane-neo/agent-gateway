import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
import { postgres } from "./db.js";

// A base64-encoded image attached to a prompt.
export interface PromptImage {
  media_type: string;
  data: string;
}

// A single gateway-hosted agent invocation. The gateway runs Claude Code via the
// Agent SDK, inheriting credentials from its own environment (it never handles or
// stores keys), and injects OTel env vars so the hosted run's telemetry flows
// through the same collector → ClickHouse → projector pipeline and appears in the
// session list. The submitted prompt and final result are also persisted here so
// they remain visible even before/without telemetry.

export interface AgentPrompt {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
  claude_session_id: string | null;
  resume_session_id: string | null;
  num_turns: number | null;
  cost_usd: string | null;
  image_count: number;
  created_at: string;
  updated_at: string;
}

// In-flight controllers so a prompt can be cancelled.
const running = new Map<string, AbortController>();

export async function ensureAgentSchema(): Promise<void> {
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS agent_prompts (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      prompt text NOT NULL,
      status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
      result text,
      error text,
      claude_session_id text,
      resume_session_id text,
      num_turns int,
      cost_usd numeric(18,8),
      image_count int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await postgres.query(
    "ALTER TABLE agent_prompts ADD COLUMN IF NOT EXISTS image_count int NOT NULL DEFAULT 0"
  );
  await postgres.query(
    "CREATE INDEX IF NOT EXISTS agent_prompts_created_at_idx ON agent_prompts (created_at DESC)"
  );
}

// Build the environment for the hosted run: inherit everything (credentials
// included) and layer on the telemetry export config so it lands in our pipeline.
function hostedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
  env.OTEL_LOGS_EXPORTER = "otlp";
  env.OTEL_METRICS_EXPORTER = "otlp";
  env.OTEL_EXPORTER_OTLP_PROTOCOL = "grpc";
  env.OTEL_EXPORTER_OTLP_ENDPOINT = config.AGENT_OTEL_ENDPOINT;
  env.OTEL_LOG_USER_PROMPTS = "1";
  env.OTEL_RESOURCE_ATTRIBUTES =
    env.OTEL_RESOURCE_ATTRIBUTES ||
    "service.name=claude-code,deployment.environment=gateway-hosted";
  return env;
}

async function markSession(id: string, sessionId: string): Promise<void> {
  await postgres.query(
    "UPDATE agent_prompts SET claude_session_id = $2, updated_at = now() WHERE id = $1",
    [id, sessionId]
  );
}

async function finish(
  id: string,
  status: "completed" | "failed",
  fields: {
    result?: string | null;
    error?: string | null;
    claudeSessionId?: string | null;
    numTurns?: number | null;
    costUsd?: number | null;
  }
): Promise<void> {
  await postgres.query(
    `
      UPDATE agent_prompts
      SET status = $2,
          result = COALESCE($3, result),
          error = $4,
          claude_session_id = COALESCE($5, claude_session_id),
          num_turns = $6,
          cost_usd = $7,
          updated_at = now()
      WHERE id = $1
    `,
    [
      id,
      status,
      fields.result ?? null,
      fields.error ?? null,
      fields.claudeSessionId ?? null,
      fields.numTurns ?? null,
      fields.costUsd ?? null
    ]
  );
}

// Build the query prompt. Text-only stays a plain string; when images are
// attached we hand the SDK a streaming input of a single multimodal user
// message (text + base64 image blocks), which the iterator closes to trigger
// exactly one turn.
function buildPrompt(
  text: string,
  images: PromptImage[]
): string | AsyncIterable<SDKUserMessage> {
  if (!images.length) return text;
  const content = [
    ...(text ? [{ type: "text" as const, text }] : []),
    ...images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.media_type,
        data: img.data
      }
    }))
  ];
  const message = {
    type: "user",
    parent_tool_use_id: null,
    message: { role: "user", content }
  } as unknown as SDKUserMessage;
  return (async function* () {
    yield message;
  })();
}

// Drive one hosted run to completion in the background.
async function runAgent(
  id: string,
  promptText: string,
  resumeSessionId: string | null,
  images: PromptImage[]
): Promise<void> {
  const controller = new AbortController();
  running.set(id, controller);
  let claudeSessionId: string | null = null;

  try {
    const q = query({
      prompt: buildPrompt(promptText, images),
      options: {
        cwd: config.AGENT_WORKSPACE,
        permissionMode: config.AGENT_PERMISSION_MODE,
        ...(config.AGENT_PERMISSION_MODE === "bypassPermissions"
          ? { allowDangerouslySkipPermissions: true }
          : {}),
        ...(resumeSessionId ? { resume: resumeSessionId } : {}),
        ...(config.AGENT_MODEL ? { model: config.AGENT_MODEL } : {}),
        env: hostedEnv(),
        abortController: controller
      }
    });

    for await (const message of q) {
      if (message.type === "system" && message.subtype === "init") {
        claudeSessionId = message.session_id;
        await markSession(id, claudeSessionId);
      } else if (message.type === "result") {
        claudeSessionId = message.session_id ?? claudeSessionId;
        const ok = message.subtype === "success" && !message.is_error;
        // On a success-subtype-but-is_error result (e.g. "Not logged in"), the
        // detail lives in `result`; otherwise the subtype names the failure.
        const resultText =
          message.subtype === "success" ? message.result : null;
        await finish(id, ok ? "completed" : "failed", {
          result: resultText,
          error: ok
            ? null
            : message.subtype === "success"
              ? resultText || "run_error"
              : message.subtype,
          claudeSessionId,
          numTurns: message.num_turns,
          costUsd: message.total_cost_usd
        });
        return;
      }
    }

    // Iterator ended without a terminal result message.
    await finish(id, "completed", { claudeSessionId });
  } catch (error) {
    await finish(id, "failed", {
      claudeSessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    running.delete(id);
  }
}

export async function submitPrompt(
  prompt: string,
  resumeSessionId: string | null,
  images: PromptImage[] = []
): Promise<AgentPrompt> {
  const { rows } = await postgres.query<AgentPrompt>(
    `
      INSERT INTO agent_prompts (prompt, status, resume_session_id, image_count)
      VALUES ($1, 'running', $2, $3)
      RETURNING *
    `,
    [prompt, resumeSessionId, images.length]
  );
  const row = rows[0]!;
  // Fire and forget; progress is tracked in the DB row and via telemetry.
  void runAgent(row.id, prompt, resumeSessionId, images);
  return row;
}

export async function listPrompts(limit: number): Promise<AgentPrompt[]> {
  const { rows } = await postgres.query<AgentPrompt>(
    "SELECT * FROM agent_prompts ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows;
}

export async function getPrompt(id: string): Promise<AgentPrompt | null> {
  const { rows } = await postgres.query<AgentPrompt>(
    "SELECT * FROM agent_prompts WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}
