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

export async function clickhouseTableExists(table: string): Promise<boolean> {
  const result = await clickhouse.query({
    query: `
      SELECT count() AS count
      FROM system.tables
      WHERE database = currentDatabase()
        AND name = {table:String}
    `,
    query_params: { table },
    format: "JSONEachRow"
  });
  const rows = await result.json<{ count: string }>();
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function closeDatabases(): Promise<void> {
  await Promise.all([postgres.end(), clickhouse.close()]);
}
