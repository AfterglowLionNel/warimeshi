import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type OrderUpdate = {
  member_id?: string
  item_name?: string | null
  unit_price?: number
  quantity?: number
  line_total?: number
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const resolvedParams = await Promise.resolve((context as any)?.params)
  const orderId =
    resolvedParams?.id ||
    (() => {
      const segments = new URL(request.url).pathname.split("/").filter(Boolean)
      return segments[segments.length - 1]
    })()
  const body = await request.json().catch(() => ({}))
  const updates = body && typeof body === "object" ? ((body as any).updates ?? body) : {}

  if (!orderId) {
    return NextResponse.json({ error: "Invalid payload: order id is required" }, { status: 400 })
  }

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("firebase_uid", user.id)
    .single()

  if (userError || !dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 })
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, table_id, member_id, created_by_user_id, unit_price, quantity, deleted_at")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError || !order || order.deleted_at) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 })
  }

  const [{ data: table }, { data: member }] = await Promise.all([
    supabase.from("tables").select("id, owner_user_id, is_archived").eq("id", order.table_id).maybeSingle(),
    supabase.from("table_members").select("id, user_id").eq("id", order.member_id).maybeSingle(),
  ])

  if (table?.is_archived && table.owner_user_id !== dbUser.id) {
    return NextResponse.json({ error: "このテーブルはアーカイブされています" }, { status: 403 })
  }

  const isOwner = table?.owner_user_id === dbUser.id
  const isCreator = order.created_by_user_id === dbUser.id
  const isOrderMember = member?.user_id === dbUser.id

  if (!isOwner && !isCreator && !isOrderMember) {
    return NextResponse.json({ error: "注文を編集する権限がありません" }, { status: 403 })
  }

  const unitPrice = updates.unit_price !== undefined ? Number(updates.unit_price) : order.unit_price
  const quantity = updates.quantity !== undefined ? Number(updates.quantity) : order.quantity

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "金額が不正です" }, { status: 400 })
  }

  if (Number.isNaN(quantity) || quantity < 1) {
    return NextResponse.json({ error: "数量が不正です" }, { status: 400 })
  }

  const payload: OrderUpdate = {
    member_id: updates.member_id ?? order.member_id,
    item_name: updates.item_name ?? order.item_name ?? null,
    unit_price: unitPrice,
    quantity,
    line_total: unitPrice * quantity,
  }

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .is("deleted_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orderId = params.id
  if (!orderId) {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
