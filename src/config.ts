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
  COOKIE_SECURE: boolFromEnv(false),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
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
  STALE_AFTER_SECONDS: z.coerce.number().int().positive().default(120)
});

export const config = schema.parse(process.env);
