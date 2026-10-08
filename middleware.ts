import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/constants";
import { verifySessionToken } from "@/lib/session";

function isPublic(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/api/auth/login") return true;
  if (pathname.startsWith("/api/bot/") || pathname === "/api/bot") return true;
  if (pathname.startsWith("/api/cron/")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = Boolean(secret && token && (await verifySessionToken(token, secret)));

  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isPublic(pathname)) return NextResponse.next();
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|splash/|sw.js|manifest.webmanifest).*)"],
};
