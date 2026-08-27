import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { postgres } from "./db.js";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "ag_session";
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

// scrypt hash stored as `scrypt$<saltHex>$<hashHex>`.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// Well-formed but non-matching hash used to keep login timing constant when a
// username does not exist, mitigating user enumeration.
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(KEY_LENGTH)}`;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

async function ensureAuthSchema(app: FastifyInstance): Promise<void> {
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS users (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
  `);
  await postgres.query(
    `CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);`
  );
  await postgres.query(
    `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);`
  );

  const { rows } = await postgres.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users"
  );
  if (rows[0]?.count === "0") {
    const passwordHash = await hashPassword(config.ADMIN_PASSWORD);
    await postgres.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING",
      [config.ADMIN_USERNAME, passwordHash]
    );
    app.log.info({ username: config.ADMIN_USERNAME }, "seeded bootstrap admin user");
    if (config.ADMIN_PASSWORD === "admin") {
      app.log.warn(
        "ADMIN_PASSWORD is the default 'admin'; set a strong ADMIN_PASSWORD and recreate the users row"
      );
    }
  }
}

async function lookupSession(token: string): Promise<AuthUser | null> {
  const { rows } = await postgres.query<AuthUser>(
    `
      SELECT u.id::text AS id, u.username
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}

async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3_600_000);
  await postgres.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, expiresAt]
  );
  return { token, expiresAt };
}

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.COOKIE_SECURE,
    path: "/",
    expires: expiresAt
  });
}

// Paths reachable without an authenticated session. Everything else under
// `/api/` requires a valid session cookie. Non-API paths (HTML pages, assets)
// stay public and rely on client-side redirects.
const PUBLIC_API_PATHS = new Set([
  "/health",
  "/api/auth/login",
  "/api/auth/me"
]);

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  app.decorateRequest("user", null);
  await ensureAuthSchema(app);

  if (!config.AUTH_ENABLED) {
    app.log.warn("AUTH_ENABLED=false; API authentication is DISABLED");
  }

  // Resolve the session on every request, then guard the API surface.
  app.addHook("onRequest", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? await lookupSession(token) : null;

    if (!config.AUTH_ENABLED) return;

    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/api/")) return;
    if (PUBLIC_API_PATHS.has(path)) return;
    if (!request.user) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const { rows } = await postgres.query<{
      id: string;
      username: string;
      password_hash: string;
    }>(
      "SELECT id::text AS id, username, password_hash FROM users WHERE username = $1",
      [parsed.data.username]
    );
    const account = rows[0];
    const ok = await verifyPassword(
      parsed.data.password,
      account?.password_hash ?? DUMMY_HASH
    );
    if (!account || !ok) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const { token, expiresAt } = await createSession(account.id);
    setSessionCookie(reply, token, expiresAt);
    return { user: { id: account.id, username: account.username } };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await postgres.query("DELETE FROM sessions WHERE token_hash = $1", [
        hashToken(token)
      ]);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request) => {
    return { user: request.user };
  });
}
