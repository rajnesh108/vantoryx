import type { Request, Response } from "express";
import { deleteSession, findSessionUser } from "../db/users";
import { HttpError } from "../lib/http";

export const SESSION_COOKIE = "vantoryx_session";

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function requireUser(req: Request): Promise<{ id: string; username: string }> {
  const token = readSessionToken(req);
  const user = token ? await findSessionUser(token) : null;
  if (!user) throw new HttpError(401, "Sign in required.");
  return user;
}

export function setSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  res.setHeader("Set-Cookie", cookieValue(`${token}`, maxAgeSeconds));
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const token = readSessionToken(req);
  if (token) await deleteSession(token);
  res.setHeader("Set-Cookie", cookieValue("", 0));
}

function cookieValue(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
