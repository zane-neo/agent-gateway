import {
  createHash,
  randomBytes,
  scrypt as scryptCallback
} from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import { config } from "./config.js";
import { postgres } from "./db.js";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export interface AuthUser {
  id: string;
  username: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export function deriveClientToken(username: string, password: string): string {
  return createHash("sha256")
    .update(`${username}:${password}`, "utf8")
    .digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(header.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

async function ensureAuthSchema(app: FastifyInstance): Promise<void> {
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS users (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      api_token_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await postgres.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_token_hash text"
  );
  await postgres.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()"
  );
  await postgres.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_api_token_hash_idx ON users (api_token_hash) WHERE api_token_hash IS NOT NULL"
  );

  const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
  const clientToken = deriveClientToken(
    config.ADMIN_USERNAME,
    config.ADMIN_PASSWORD
  );
  const apiTokenHash = hashToken(clientToken);

  await postgres.query(
    `
      INSERT INTO users (username, password_hash, api_token_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        api_token_hash = EXCLUDED.api_token_hash,
        updated_at = now()
    `,
    [config.ADMIN_USERNAME, passwordHash, apiTokenHash]
  );

  app.log.info(
    { username: config.ADMIN_USERNAME },
    "ensured bootstrap API user"
  );
  if (config.ADMIN_PASSWORD === "admin") {
    app.log.warn(
      "ADMIN_PASSWORD is the default 'admin'; set a strong password before exposing the API"
    );
  }
}

export async function lookupToken(token: string): Promise<AuthUser | null> {
  const suppliedHash = hashToken(token);
  const { rows } = await postgres.query<AuthUser>(
    `
      SELECT id::text AS id, username
      FROM users
      WHERE api_token_hash = $1
    `,
    [suppliedHash]
  );
  return rows[0] ?? null;
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest("user", null);
  await ensureAuthSchema(app);

  if (!config.AUTH_ENABLED) {
    app.log.warn("AUTH_ENABLED=false; API authentication is DISABLED");
  }

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/api/")) return;
    if (!config.AUTH_ENABLED) return;

    const token = bearerToken(request.headers.authorization);
    request.user = token ? await lookupToken(token) : null;
    if (!request.user) {
      reply.header("WWW-Authenticate", "Bearer");
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/auth/me", async (request) => {
    return { user: request.user };
  });
}
