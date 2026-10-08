import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_TTL_SECONDS, TIMEZONE } from "./constants";
import { HttpError } from "./errors";
import { displayName } from "./profile";
import { createSessionToken, verifySessionToken } from "./session";
import { deviceHealthToken } from "./services/health";
import { readCookie } from "./text";

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function cookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function isAuthedRequest(req: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = readCookie(req.headers.get("cookie") ?? "", COOKIE_NAME);
  if (!token) return false;
  return verifySessionToken(token, secret);
}

export function isBotRequest(req: Request) {
  const expected = process.env.BOT_API_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return safeEqual(header.slice("Bearer ".length).trim(), expected);
}

export async function isHealthRequest(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return false;
  const env = process.env.HEALTH_SYNC_TOKEN;
  if (env && safeEqual(token, env)) return true;
  const stored = await deviceHealthToken();
  return Boolean(stored && safeEqual(token, stored));
}

export function isCronRequest(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return safeEqual(header.slice("Bearer ".length).trim(), expected);
}

export async function startSession() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError("Sign-in isn't configured yet.", 500);
  const token = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true, name: displayName(), timezone: TIMEZONE });
  res.cookies.set(COOKIE_NAME, token, cookieOptions());
  return res;
}

export function clearSession() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  return res;
}
