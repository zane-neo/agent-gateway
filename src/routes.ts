import type { FastifyInstance } from "fastify";
import {
  getPrompt,
  listPrompts,
  submitPrompt,
  type PromptImage
} from "./agent.js";
import { toClickHouseDateTime64 } from "./clickhouse-time.js";
import { config } from "./config.js";
import { clickhouse, clickhouseTableExists, postgres } from "./db.js";

interface ListRunsQuery {
  status?: string;
  limit?: string;
  cursor?: string;
}

interface RunParams {
  runId: string;
}

interface EventsQuery {
  limit?: string;
  after?: string;
}

interface SubmitPromptBody {
  prompt?: string;
  resumeSessionId?: string;
  images?: PromptImage[];
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp"
]);
const MAX_IMAGES = 8;

interface PromptParams {
  id: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListRunsQuery }>("/api/runs", async (request) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
    const values: unknown[] = [];
    const filters: string[] = [];

    if (request.query.status) {
      values.push(request.query.status);
      filters.push(`status = $${values.length}`);
    }
    if (request.query.cursor) {
      values.push(new Date(request.query.cursor));
      filters.push(`last_event_at < $${values.length}`);
    }
    values.push(limit);

    const result = await postgres.query(
      `
        SELECT *
        FROM agent_runs
        ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
        ORDER BY last_event_at DESC
        LIMIT $${values.length}
      `,
      values
    );
    return {
      items: result.rows,
      nextCursor:
        result.rows.length === limit
          ? result.rows[result.rows.length - 1]?.last_event_at
          : null
    };
  });

  app.get<{ Params: RunParams }>("/api/runs/:runId", async (request, reply) => {
    const result = await postgres.query(
      "SELECT * FROM agent_runs WHERE run_id = $1",
      [request.params.runId]
    );
    const run = result.rows[0];
    if (!run) return reply.code(404).send({ error: "run_not_found" });
    return run;
  });

  app.get<{ Params: RunParams; Querystring: EventsQuery }>(
    "/api/runs/:runId/events",
    async (request, reply) => {
      const runResult = await postgres.query<{ session_id: string }>(
        "SELECT session_id FROM agent_runs WHERE run_id = $1",
        [request.params.runId]
      );
      const run = runResult.rows[0];
      if (!run) return reply.code(404).send({ error: "run_not_found" });

      const limit = Math.min(Math.max(Number(request.query.limit) || 500, 1), 2000);
      // Events are returned in chronological order so the UI can render a
      // conversation timeline and append newer events. `after` is an exclusive
      // lower bound cursor (the timestamp of the last event already shown).
      const after = request.query.after
        ? new Date(request.query.after)
        : new Date(0);

      if (!(await clickhouseTableExists("otel_logs"))) {
        return { items: [] };
      }

      const result = await clickhouse.query({
        query: `
          SELECT
            formatDateTime(Timestamp, '%FT%T.%fZ', 'UTC') AS timestamp,
            TraceId AS traceId,
            SpanId AS spanId,
            SeverityText AS severity,
            Body AS body,
            LogAttributes AS attributes
          FROM otel_logs
          WHERE Timestamp > {after:DateTime64(9)}
            AND (
              LogAttributes['session.id'] = {sessionId:String}
              OR LogAttributes['session_id'] = {sessionId:String}
              OR Body ILIKE concat('%', {sessionId:String}, '%')
            )
          ORDER BY Timestamp ASC
          LIMIT {limit:UInt32}
        `,
        query_params: {
          sessionId: run.session_id,
          after: toClickHouseDateTime64(after),
          limit
        },
        format: "JSONEachRow"
      });

      const items = await result.json();
      return { items };
    }
  );

  // ---- Gateway-hosted agent control ----

  app.post<{ Body: SubmitPromptBody }>(
    "/api/agent/prompts",
    async (request, reply) => {
      if (!config.AGENT_ENABLED) {
        return reply.code(403).send({ error: "agent_disabled" });
      }
      const prompt = request.body?.prompt?.trim() ?? "";
      const rawImages = request.body?.images;
      const images: PromptImage[] = Array.isArray(rawImages) ? rawImages : [];

      // A prompt needs text, image(s), or both.
      if (!prompt && !images.length) {
        return reply.code(400).send({ error: "prompt_required" });
      }
      if (images.length > MAX_IMAGES) {
        return reply.code(400).send({ error: "too_many_images" });
      }
      for (const img of images) {
        if (
          !img ||
          typeof img.data !== "string" ||
          !img.data ||
          !ALLOWED_IMAGE_TYPES.has(img.media_type)
        ) {
          return reply.code(400).send({ error: "invalid_image" });
        }
      }

      const resumeSessionId = request.body?.resumeSessionId?.trim() || null;
      const row = await submitPrompt(prompt, resumeSessionId, images);
      return reply.code(202).send(row);
    }
  );

  app.get("/api/agent/prompts", async (request) => {
    const limit = Math.min(
      Math.max(Number((request.query as ListRunsQuery).limit) || 50, 1),
      200
    );
    return { items: await listPrompts(limit) };
  });

  app.get<{ Params: PromptParams }>(
    "/api/agent/prompts/:id",
    async (request, reply) => {
      const row = await getPrompt(request.params.id);
      if (!row) return reply.code(404).send({ error: "prompt_not_found" });
      return row;
    }
  );

  app.get("/api/stats", async () => {
    const result = await postgres.query(`
      SELECT
        count(*)::int AS total_runs,
        count(*) FILTER (WHERE status = 'running')::int AS running,
        count(*) FILTER (WHERE status LIKE 'waiting_%')::int AS waiting,
        count(*) FILTER (WHERE status = 'failed')::int AS failed,
        COALESCE(sum(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(sum(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(sum(estimated_cost_usd), 0) AS estimated_cost_usd
      FROM agent_runs
    `);
    return result.rows[0];
  });
}
