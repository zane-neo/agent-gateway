import { z } from "zod";

const boolFromEnv = (def: boolean) =>
  z.preprocess(
    (value) => (value === undefined ? def : value === "true" || value === "1"),
    z.boolean()
  );

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  AUTH_ENABLED: boolFromEnv(true),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("admin"),
  POSTGRES_URL: z
    .string()
    .default("postgres://agent_gateway:agent_gateway@localhost:5432/agent_gateway"),
  CLICKHOUSE_URL: z.string().url().default("http://localhost:8123"),
  CLICKHOUSE_DATABASE: z.string().default("otel"),
  CLICKHOUSE_USER: z.string().default("default"),
  CLICKHOUSE_PASSWORD: z.string().default(""),
  PROJECTION_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  STALE_AFTER_SECONDS: z.coerce.number().int().positive().default(120),

  // Gateway-hosted agent execution. The gateway runs Claude Code in-process via
  // the Agent SDK; it does NOT manage credentials — the API key/login is already
  // provisioned in the environment and simply inherited by the child process.
  AGENT_ENABLED: boolFromEnv(true),
  // Working directory for hosted runs.
  AGENT_WORKSPACE: z.string().default("/workspace"),
  // OTLP endpoint injected into the hosted run so its telemetry flows through the
  // same pipeline and shows up in the session list. Inside compose this is the
  // collector's service name.
  AGENT_OTEL_ENDPOINT: z.string().default("http://otel-collector:4317"),
  // Permission handling for hosted runs. Hosted runs are non-interactive, so the
  // default bypasses prompts; override to "default"/"acceptEdits" if desired.
  AGENT_PERMISSION_MODE: z
    .enum(["default", "acceptEdits", "bypassPermissions", "plan", "dontAsk"])
    .default("bypassPermissions"),
  // Optional model override for hosted runs; empty means the SDK default.
  AGENT_MODEL: z.string().default("")
});

export const config = schema.parse(process.env);
