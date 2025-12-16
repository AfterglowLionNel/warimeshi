import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const allowedProviders = ["google"]

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const provider = body?.provider as string | undefined
  const redirectTo = body?.redirectTo as string | undefined

  if (!provider || !allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  })

  if (error || !data?.url) {
    return NextResponse.json({ error: error?.message ?? "Failed to start OAuth" }, { status: 400 })
  }

  return NextResponse.json({ url: data.url })
}
