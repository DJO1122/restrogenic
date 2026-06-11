import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Multi-tenant subdomain routing.
 *
 * Resolves the shop ("tenant") from the request Host header:
 *   spice.yourpos.com  → subdomain "spice"
 *   yourpos.com / www  → marketing/root (no tenant)
 *   localhost / *.localhost / 127.0.0.1 / *.vercel.app → dev: no tenant lock
 *
 * The resolved subdomain is forwarded to the app as the `x-tenant` request
 * header so server components / route handlers can read it. Actual data access
 * is still authorized by the JWT's restaurantId (defense in depth) — the
 * subdomain is for routing/branding and to pre-fill the right shop context.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "yourpos.com";

function getSubdomain(host: string): string | null {
  const hostname = host.split(":")[0]; // strip port
  // dev hosts never carry a tenant
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app")
  ) {
    return null;
  }
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) return null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -1 * (ROOT_DOMAIN.length + 1));
    return sub === "www" || sub === "api" || sub === "admin" ? null : sub;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const subdomain = getSubdomain(host);

  const requestHeaders = new Headers(req.headers);
  if (subdomain) requestHeaders.set("x-tenant", subdomain);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // expose to client too (read-only hint for branding / which shop)
  if (subdomain) res.headers.set("x-tenant", subdomain);
  return res;
}

export const config = {
  // run on all app routes except static assets & the Next internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$).*)"],
};
