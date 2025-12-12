import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PROTECTED_PREFIXES = ["/group", "/solo", "/settings"]

export async function middleware(request: NextRequest) {
  const res = await updateSession(request)

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

  // Keep this lightweight: block obvious unauthenticated access by checking auth cookies
  const hasAuthCookie = hasSupabaseSessionCookie

  if (alreadyRedirecting) {
    return res
  }

  if (isProtected && !hasAuthCookie) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com"
    const url = new URL(base)
    url.pathname = "/auth/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url.toString())
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
