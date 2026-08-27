import { createClient } from "@clickhouse/client";
import pg from "pg";
import { config } from "./config.js";

export const postgres = new pg.Pool({
  connectionString: config.POSTGRES_URL,
  max: 10
});

export const clickhouse = createClient({
  url: config.CLICKHOUSE_URL,
  database: config.CLICKHOUSE_DATABASE,
  username: config.CLICKHOUSE_USER,
  password: config.CLICKHOUSE_PASSWORD
});

export async function closeDatabases(): Promise<void> {
  await Promise.all([postgres.end(), clickhouse.close()]);
}
