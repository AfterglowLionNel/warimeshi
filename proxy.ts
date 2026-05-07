import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/settings"];
const NO_STORE_PREFIXES = ["/auth", "/group", "/settings"];

function buildCsp(nonce: string) {
  // ホワイトリスト方式: NODE_ENV が "development" のとき "だけ" 緩和する。
  // 未定義 / "test" / "production" など他の値はすべて本番扱いで strict を維持。
  const isDev = process.env.NODE_ENV === "development";
  // Next.js の dev モード (Turbopack/Webpack HMR) は eval を使うため unsafe-eval が必須。
  // dev では HMR の WebSocket も許可する。
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = isDev ? `'self' https: ws: wss:` : `'self' https:`;

  const csp = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data: https:;
    connect-src ${connectSrc};
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

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isNoStore = NO_STORE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthenticated = !!req.auth;

  if (isProtected && !isAuthenticated) {
    const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com";
    const url = new URL(base);
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);

    const redirectRes = NextResponse.redirect(url.toString());
    redirectRes.headers.set("Content-Security-Policy", csp);
    redirectRes.headers.set("x-nonce", nonce);
    if (isNoStore) {
      redirectRes.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
    }
    return redirectRes;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  if (isNoStore) {
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }
  return res;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
