import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/group"
  const redirectPath = next.startsWith("/") ? next : "/group"

  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  const rawHost = request.headers.get("host")
  const proto = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol

  const candidates = [
    envOrigin,
    forwardedHost ? `${proto}//${forwardedHost}` : null,
    rawHost ? `${proto}//${rawHost}` : null,
    requestUrl.origin,
  ]
  const origin =
    candidates.find((v) => v && !v.includes("localhost") && !v.includes("0.0.0.0")) ??
    candidates.find(Boolean) ??
    requestUrl.origin

  const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`)

  if (code) {
    const supabase = await createClient(redirectResponse)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return redirectResponse
    }
  }

  // Return to error page on failure
  return NextResponse.redirect(`${origin}/auth/error?error=callback_failed`)
}
