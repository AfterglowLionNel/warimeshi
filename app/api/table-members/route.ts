import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tableId = body?.tableId as string | undefined
  const displayName = body?.displayName as string | undefined

  if (!tableId || !displayName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  // Ensure table exists and check archive/owner status
  const { data: table } = await supabase
    .from("tables")
    .select("id, owner_user_id, is_archived")
    .eq("id", tableId)
    .single()

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id, email, nickname")
    .eq("firebase_uid", user.id)
    .single()

  if (userError || !dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 })
  }

  if (table?.is_archived && table.owner_user_id !== dbUser.id) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 })
  }

  const { error } = await supabase.from("table_members").insert({
    table_id: tableId,
    user_id: dbUser.id,
    display_name: displayName.trim(),
    is_master: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get("tableId")

  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 })
  }

  // Ensure table exists and check archive/owner status
  const { data: table } = await supabase
    .from("tables")
    .select("id, owner_user_id, is_archived")
    .eq("id", tableId)
    .single()

  const { data: dbUser } = await supabase.from("users").select("id").eq("firebase_uid", user.id).single()

  if (table?.is_archived && table.owner_user_id !== dbUser?.id) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("table_members")
    .select("*, user:users(*)")
    .eq("table_id", tableId)
    .order("joined_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
