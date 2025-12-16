import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PROTECTED_PREFIXES = ["/group", "/solo", "/settings"]

function buildCsp(nonce: string) {
  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data: https:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com;
    media-src 'self' https:;
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
    form-action 'self';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim()

  return csp
}

export async function middleware(request: NextRequest) {
  const csp = buildCsp("")
  const res = await updateSession(request)

  res.headers.set("Content-Security-Policy", csp)

  const supabaseProjectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : ""
  const supabaseCookiePrefix = supabaseProjectRef ? `sb-${supabaseProjectRef}-auth-token` : "sb-"

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const alreadyRedirecting = res.headers.get("location")
  const cookieNames = request.cookies.getAll().map((c) => c.name)
  const hasSupabaseSessionCookie = cookieNames.some(
    (name) =>
      name === "supabase-auth-token" ||
      name.startsWith(supabaseCookiePrefix) ||
      name === "sb-access-token" ||
      name === "sb-refresh-token",
  )

  console.log("[mw-guard]", {
    pathname,
    cookieNames,
    supabaseCookiePrefix,
    hasSupabaseSessionCookie,
    alreadyRedirecting,
  })

  const hasAuthCookie = hasSupabaseSessionCookie

  if (alreadyRedirecting) {
    return res
  }

  if (isProtected && !hasAuthCookie) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com"
    const url = new URL(base)
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", pathname)

    const redirectRes = NextResponse.redirect(url.toString())
    redirectRes.headers.set("Content-Security-Policy", csp)
    return redirectRes
  }

  return NextResponse.next({
    request: { headers: request.headers },
    headers: res.headers,
  })
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
