import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { CalculationMode, FareSettings, VehicleType } from "@/lib/types/taxi"

type TaxiRecordPayload = {
  tableId: string
  vehicleType: VehicleType
  mode: CalculationMode
  settings: FareSettings
  input: any
  result: any
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as TaxiRecordPayload | null
  if (!body?.tableId || !body.vehicleType || !body.mode) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id, email, nickname")
    .eq("firebase_uid", user.id)
    .single()

  if (userError || !dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("taxi_records")
    .insert({
      table_id: body.tableId,
      created_by_user_id: dbUser.id,
      vehicle_type: body.vehicleType,
      mode: body.mode,
      settings: body.settings,
      input: body.input,
      result: body.result,
    })
    .select("*")
    .single()

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

  const { data, error } = await supabase
    .from("taxi_records")
    .select("*")
    .eq("table_id", tableId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
