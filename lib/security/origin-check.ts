import "server-only";

// Route Handlers の状態変更 (POST/PATCH/DELETE) で同一オリジンを強制するヘルパ。
// Next.js v14+ では Server Actions は自動的に Origin/Host を比較してくれるが、
// Route Handlers は別途検証が必要。Auth.js の SameSite cookie で多くの CSRF は
// 防げているため、これは「二重防御」と「リクエスト元のサニティチェック」が目的。
//
// 検証ロジック:
//   1. Origin ヘッダがある場合: Origin のオリジンが許可リストに含まれていること
//   2. Origin が無く Referer がある場合: Referer のオリジンが許可リストに含まれていること
//   3. どちらも無いリクエストは form fetch 等で発生し得るが、CSRF として扱い拒否
//
// 許可リスト:
//   - AUTH_URL / NEXT_PUBLIC_SITE_URL の値
//   - 開発時は localhost も許容 (NODE_ENV !== production)

function envOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOrigins(): Set<string> {
  const out = new Set<string>();
  const authOrigin = envOrigin(process.env.AUTH_URL);
  const siteOrigin = envOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (authOrigin) out.add(authOrigin);
  if (siteOrigin) out.add(siteOrigin);
  if (process.env.NODE_ENV !== "production") {
    out.add("http://localhost:3000");
    out.add("http://localhost:3001");
    out.add("http://127.0.0.1:3000");
    out.add("http://127.0.0.1:3001");
  }
  return out;
}

function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  // Next.js は proxy 経由で動くため、x-forwarded-proto / x-forwarded-host があれば優先
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

function originOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const allow = allowedOrigins();
  // 自分自身のオリジンも常に許可
  allow.add(getRequestOrigin(request));

  const origin = request.headers.get("origin");
  if (origin) {
    return allow.has(origin);
  }

  // Origin が無い場合は Referer をフォールバック
  const referer = originOf(request.headers.get("referer"));
  if (referer) {
    return allow.has(referer);
  }

  // どちらも無いリクエストは CSRF と見做して拒否
  return false;
}

import { NextResponse } from "next/server";

// state-changing API の冒頭で呼び、null なら処理続行、Response なら早期 return する。
//   const fail = requireSameOrigin(request)
//   if (fail) return fail
export function requireSameOrigin(request: Request): NextResponse | null {
  if (isSameOriginRequest(request)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
