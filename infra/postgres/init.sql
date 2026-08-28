CREATE TABLE IF NOT EXISTS agent_runs (
  run_id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  agent_type text NOT NULL DEFAULT 'claude-code',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  ended_at timestamptz,
  current_event text,
  current_tool text,
  waiting_reason text,
  prompt_count bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(18, 8) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Human-readable session name derived from the first user prompt; falls back
  -- to the session UUID in the UI when absent (e.g. prompts were redacted).
  title text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('running', 'waiting_for_user', 'waiting_for_permission', 'completed', 'failed', 'stale'))
);

CREATE INDEX IF NOT EXISTS agent_runs_status_last_event_idx
  ON agent_runs (status, last_event_at DESC);

CREATE TABLE IF NOT EXISTS projection_checkpoints (
  projector text PRIMARY KEY,
  cursor_timestamp timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO projection_checkpoints (projector, cursor_timestamp)
VALUES ('claude-code-logs', '1970-01-01T00:00:00Z')
ON CONFLICT (projector) DO NOTHING;

-- Authentication users. The application derives and upserts the bootstrap
-- user's password/token hashes at startup from ADMIN_USERNAME/ADMIN_PASSWORD.
CREATE TABLE IF NOT EXISTS users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  api_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_api_token_hash_idx
  ON users (api_token_hash)
  WHERE api_token_hash IS NOT NULL;
