import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { closeDatabases, postgres } from "./db.js";
import { projectOnce } from "./projector.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await registerRoutes(app);

let projecting = false;
const interval = setInterval(async () => {
  if (projecting) return;
  projecting = true;
  try {
    const count = await projectOnce();
    if (count > 0) app.log.info({ count }, "projected Claude Code events");
    await postgres.query(
      `
        UPDATE agent_runs
        SET status = 'stale', updated_at = now()
        WHERE status IN ('running', 'waiting_for_user', 'waiting_for_permission')
          AND last_event_at < now() - make_interval(secs => $1)
      `,
      [config.STALE_AFTER_SECONDS]
    );
  } catch (error) {
    app.log.error(error, "projection failed");
  } finally {
    projecting = false;
  }
}, config.PROJECTION_INTERVAL_MS);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  clearInterval(interval);
  await app.close();
  await closeDatabases();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.PORT });
