import { Router } from "express";
import { z } from "zod";
import { clearSession, readSessionToken, setSessionCookie } from "../auth/session";
import { verifyPassword } from "../auth/password";
import { createSession, findSessionUser, findUserByUsername } from "../db/users";
import { asyncHandler, HttpError } from "../lib/http";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter a username.").max(64),
  password: z.string().min(1, "Enter a password.").max(200),
});

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await findUserByUsername(body.username);
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) throw new HttpError(401, "Username or password is incorrect.");

    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.maxAgeSeconds);
    res.json({ username: user.username });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await clearSession(req, res);
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const token = readSessionToken(req);
    const user = token ? await findSessionUser(token) : null;
    if (!user) throw new HttpError(401, "Sign in required.");
    res.json({ username: user.username });
  })
);
