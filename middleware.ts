import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/settings"];

function buildCsp() {
  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data: https:;
    connect-src 'self' https:;
    media-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
    form-action 'self' https://accounts.google.com https://access.line.me;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  return csp;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const csp = buildCsp();
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthenticated = !!req.auth;

  console.log("[mw-guard]", {
    pathname,
    isAuthenticated,
    userId: req.auth?.user?.id,
  });

  if (isProtected && !isAuthenticated) {
    const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com";
    const url = new URL(base);
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);

    const redirectRes = NextResponse.redirect(url.toString());
    redirectRes.headers.set("Content-Security-Policy", csp);
    return redirectRes;
  }

  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
