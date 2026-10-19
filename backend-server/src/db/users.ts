import { randomBytes, randomUUID } from "crypto";
import { pool } from "./pool";
import { hashPassword } from "../auth/password";

const SESSION_DAYS = 7;

export async function ensureAdmin(username: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (id, username, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [randomUUID(), username, passwordHash]
  );
}

export async function findUserByUsername(
  username: string
): Promise<{ id: string; username: string; passwordHash: string } | null> {
  const result = await pool.query<{ id: string; username: string; password_hash: string }>(
    `SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)`,
    [username]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, passwordHash: row.password_hash };
}

export async function createSession(userId: string): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = randomBytes(32).toString("hex");
  const maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60;
  await pool.query(`DELETE FROM sessions WHERE expires_at <= now()`);
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [token, userId, maxAgeSeconds]
  );
  return { token, maxAgeSeconds };
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export async function findSessionUser(token: string): Promise<{ id: string; username: string } | null> {
  const result = await pool.query<{ id: string; username: string }>(
    `SELECT u.id, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return result.rows[0] ?? null;
}
