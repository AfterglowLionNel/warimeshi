import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateInviteToken } from "@/lib/utils/format"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tableName = body?.tableName as string | undefined
  const eventDate = body?.eventDate as string | undefined
  const displayName = body?.displayName as string | undefined

  if (!tableName || !eventDate || !displayName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("firebase_uid", user.id)
    .single()

  if (userError || !dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 })
  }

  const inviteToken = generateInviteToken()

  const { data: newTable, error: tableError } = await supabase
    .from("tables")
    .insert({
      owner_user_id: dbUser.id,
      name: tableName.trim(),
      event_date: eventDate,
      invite_token: inviteToken,
    })
    .select()
    .single()

  if (tableError || !newTable) {
    return NextResponse.json({ error: tableError?.message || "Failed to create table" }, { status: 400 })
  }

  const { error: memberError } = await supabase.from("table_members").insert({
    table_id: newTable.id,
    user_id: dbUser.id,
    display_name: displayName.trim(),
    is_master: true,
  })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, inviteToken })
}
