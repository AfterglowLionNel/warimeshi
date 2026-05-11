import { NextResponse } from "next/server";

// 同一オリジン内の相対パスのみ許可する。
// "//evil.com/..." 形式のプロトコル相対 URL を弾かないと Open Redirect になる。
function safeInternalPath(input: string | null, fallback = "/group"): string {
  if (!input) return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  if (input.startsWith("/\\")) return fallback;
  return input;
}

// This route is deprecated - Auth.js handles OAuth callbacks at /api/auth/callback/[provider]
// Keep for backwards compatibility to redirect old URLs
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const next = safeInternalPath(requestUrl.searchParams.get("next"));

  // If there's OAuth params, redirect to Auth.js callback
  if (code || state) {
    const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
    const params = new URLSearchParams(requestUrl.searchParams);
    return NextResponse.redirect(`${baseUrl}/api/auth/callback/google?${params.toString()}`);
  }

  // Otherwise redirect to the next page or home
  const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
  return NextResponse.redirect(`${baseUrl}${next}`);
}
