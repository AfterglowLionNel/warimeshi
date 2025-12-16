import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const nickname = body?.nickname as string | undefined

  if (nickname === undefined) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { error } = await supabase
    .from("users")
    .update({ nickname: nickname.trim() || null })
    .eq("firebase_uid", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: dbUser } = await supabase.from("users").select("nickname").eq("firebase_uid", user.id).single()

  return NextResponse.json({
    email: user.email,
    nickname: dbUser?.nickname ?? null,
    userMetadata: user.user_metadata ?? {},
  })
}
