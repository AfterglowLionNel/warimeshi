import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  const rawHost = request.headers.get("host")
  const hostForProto = forwardedProto || requestUrl.protocol

  const candidates = [
    envOrigin,
    forwardedHost ? `${hostForProto}//${forwardedHost}` : null,
    rawHost ? `${hostForProto}//${rawHost}` : null,
    requestUrl.origin,
  ]
  const origin = candidates.find((v) => v && !v.includes("0.0.0.0")) ?? candidates.find(Boolean) ?? requestUrl.origin

  const redirectResponse = NextResponse.redirect(origin)
  const supabase = await createClient(redirectResponse)
  await supabase.auth.signOut()

  return redirectResponse
}
