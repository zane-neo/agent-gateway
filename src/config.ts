import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
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
