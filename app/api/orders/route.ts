import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type OrderInsertPayload = {
  table_id: string
  member_id: string
  item_name: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const orders = body?.orders as OrderInsertPayload[] | undefined

  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const tableId = orders[0]?.table_id
  if (!tableId || orders.some((o) => o.table_id !== tableId)) {
    return NextResponse.json({ error: "Invalid table id" }, { status: 400 })
  }

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id, email, nickname")
    .eq("firebase_uid", user.id)
    .single()

  if (userError || !dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 })
  }

  const { data: table } = await supabase
    .from("tables")
    .select("id, owner_user_id, is_archived")
    .eq("id", tableId)
    .single()

  if (table?.is_archived && table.owner_user_id !== dbUser.id) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 })
  }

  const ordersToInsert = orders.map((order) => ({
    table_id: order.table_id,
    member_id: order.member_id,
    item_name: order.item_name,
    unit_price: order.unit_price,
    quantity: order.quantity,
    line_total: order.line_total,
    created_by_user_id: dbUser.id,
  }))

  const { data, error } = await supabase.from("orders").insert(ordersToInsert).select("*")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, data })
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

  const { data: dbUser } = await supabase.from("users").select("id").eq("firebase_uid", user.id).single()
  const { data: table } = await supabase
    .from("tables")
    .select("id, owner_user_id, is_archived")
    .eq("id", tableId)
    .single()

  if (table?.is_archived && table.owner_user_id !== dbUser?.id) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*, member:table_members(*)")
    .eq("table_id", tableId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
