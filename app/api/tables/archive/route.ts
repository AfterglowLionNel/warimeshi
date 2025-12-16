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
  const archive = body?.archive as boolean | undefined

  if (!tableId || typeof archive !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { error } = await supabase
    .from("tables")
    .update({ is_archived: archive, archived_at: archive ? new Date().toISOString() : null })
    .eq("id", tableId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
