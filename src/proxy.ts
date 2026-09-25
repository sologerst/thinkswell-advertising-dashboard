import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { appUrl } from "@/lib/site";

const PUBLIC_PREFIXES = ["/login", "/welcome", "/api/cron"];

/**
 * Optimistic gate: bounce visitors without a session cookie to /login.
 * Real authorization (valid session, role, client membership) happens in
 * lib/auth/current.ts on every page and action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // One address for everything: send production visits to *.vercel.app on to the
  // primary domain (APP_URL). API routes stay put so Vercel Cron keeps working.
  const host = request.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && host.endsWith(".vercel.app") && !pathname.startsWith("/api/")) {
    const target = new URL(pathname + search, appUrl());
    if (target.host !== host) return NextResponse.redirect(target, 308);
  }
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico|robots.txt).*)"],
};
