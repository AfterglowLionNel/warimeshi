import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function extractTableId(request: Request, params?: { id?: string }) {
  if (params?.id) return params.id

  const match = new URL(request.url).pathname.match(/\/api\/tables\/([^/]+)\/?$/)
  return match?.[1]
}

export async function DELETE(request: Request, { params }: { params: { id?: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tableId = extractTableId(request, params)
  if (!tableId) {
    return NextResponse.json({ error: "Table id is required" }, { status: 400 })
  }

  const { error } = await supabase.from("tables").delete().eq("id", tableId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
