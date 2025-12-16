import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = body?.email as string | undefined
  const password = body?.password as string | undefined
  const nickname = (body?.nickname as string | undefined) ?? undefined
  const redirectTo = body?.redirectTo as string | undefined

  if (!email || !password) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  const supabase = await createClient(response)

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        nickname: nickname || undefined,
      },
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return response
}
