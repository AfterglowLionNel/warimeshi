import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options"

export async function updateSession(request: NextRequest) {
  console.log("[hdr]", {
    host: request.headers.get("host"),
    xfHost: request.headers.get("x-forwarded-host"),
    xfProto: request.headers.get("x-forwarded-proto"),
    proto: request.nextUrl.protocol,
    url: request.nextUrl.toString(),
  })

  // Build a trusted origin for redirects (avoid falling back to localhost)
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  const rawHost = request.headers.get("host")
  const proto = forwardedProto ? `${forwardedProto}:` : request.nextUrl.protocol

  const cookieSnapshot = request.cookies.getAll().map((c) => c.name)
  console.log("[cookies]", { names: cookieSnapshot })

  const originCandidates = [
    envOrigin,
    forwardedHost ? `${proto}//${forwardedHost}` : null,
    rawHost ? `${proto}//${rawHost}` : null,
    `${request.nextUrl.protocol}//${request.nextUrl.host}`,
  ]

  const siteOrigin =
    originCandidates.find((v) => v && !v.includes("localhost") && !v.includes("0.0.0.0")) ??
    originCandidates.find(Boolean)!

  // Forward headers so Supabase can read auth cookies before rewriting the response
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getAuthCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log("[auth-check]", {
    userId: user?.id ?? null,
    authError: authError?.message ?? null,
    hasAccess: request.cookies.has("sb-access-token"),
    hasRefresh: request.cookies.has("sb-refresh-token"),
    hasLegacy: request.cookies.has("supabase-auth-token"),
  })

  // Protected routes - require authentication
  const protectedPaths = ["/group", "/settings", "/solo"]
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && isProtectedPath) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com"
    const url = new URL(base)
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url.toString())
  }

  return response
}
