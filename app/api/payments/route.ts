import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users, orders, tableMembers, payments, tables } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions"
import { tableEvents } from "@/lib/events/table-events"

// Round up to nearest 10 yen
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10
// Round down to nearest 1000 yen (bills only)
const roundDown1000 = (n: number) => Math.floor(n / 1000) * 1000

async function resolveUserId(request: Request): Promise<string | null> {
  const session = await auth()

  if (session?.user?.id) {
    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    if (dbUser) return dbUser.id
  }

  const guestToken = request.headers.get("X-Guest-Token")
  if (guestToken) {
    return await resolveUserIdFromGuestToken(guestToken)
  }

  return null
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tableId = body?.tableId as string | undefined
  const payerId = body?.payerId as string | undefined
  const splitMode = (body?.splitMode as string) || "equal"
  const memberWeights = (body?.memberWeights as Record<string, string>) || {}

  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 })
  }

  if (!payerId) {
    return NextResponse.json({ error: "会計する人を選択してください" }, { status: 400 })
  }

  // splitMode のホワイトリスト検証
  const VALID_SPLIT_MODES = ["equal", "weighted"] as const
  if (!VALID_SPLIT_MODES.includes(splitMode as typeof VALID_SPLIT_MODES[number])) {
    return NextResponse.json({ error: "Invalid splitMode" }, { status: 400 })
  }

  // memberWeights の値検証
  const VALID_WEIGHTS = ["less", "normal", "more"] as const
  for (const [, weight] of Object.entries(memberWeights)) {
    if (!VALID_WEIGHTS.includes(weight as typeof VALID_WEIGHTS[number])) {
      return NextResponse.json({ error: "Invalid weight value" }, { status: 400 })
    }
  }

  // Verify membership
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1)

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 })
  }

  // Get all members
  const members = await db
    .select({ id: tableMembers.id, displayName: tableMembers.displayName })
    .from(tableMembers)
    .where(eq(tableMembers.tableId, tableId))

  if (members.length < 2) {
    return NextResponse.json({ error: "割り勘には2人以上のメンバーが必要です" }, { status: 400 })
  }

  // Get all active orders
  const allOrders = await db
    .select({ id: orders.id, memberId: orders.memberId, lineTotal: orders.lineTotal })
    .from(orders)
    .where(and(eq(orders.tableId, tableId), isNull(orders.deletedAt)))

  const totalAmount = allOrders.reduce((s, o) => s + o.lineTotal, 0)
  if (totalAmount === 0) {
    return NextResponse.json({ error: "注文がありません" }, { status: 400 })
  }

  // Verify payer is a member
  const payer = members.find((m) => m.id === payerId)
  if (!payer) {
    return NextResponse.json({ error: "会計者がメンバーに存在しません" }, { status: 400 })
  }

  // Save settings to table (shared across all members)
  const settings = { payerId, splitMode, memberWeights }
  await db.update(tables).set({ settlementSettings: settings }).where(eq(tables.id, tableId))

  // Delete all existing payments for this table
  await db.delete(payments).where(eq(payments.tableId, tableId))

  const otherMembers = members.filter((m) => m.id !== payerId)

  // Calculate amounts per member
  const memberAmounts: Record<string, number> = {}

  if (splitMode === "weighted") {
    // 少なめ = 1000円引き（お札で払える額）、多め = その分を負担
    const normalAmount = roundUp10(totalAmount / members.length)

    const lessMembers: string[] = []
    const moreMembers: string[] = []
    const normalMembers: string[] = []

    for (const m of members) {
      const weight = memberWeights[m.id] || "normal"
      if (weight === "less") lessMembers.push(m.id)
      else if (weight === "more") moreMembers.push(m.id)
      else normalMembers.push(m.id)
    }

    // 少なめ: 普通の額から1000円引き（最低1000円）
    const lessAmount = Math.max(roundDown1000(normalAmount - 1000), 1000)

    // 普通メンバーの合計
    for (const id of normalMembers) {
      memberAmounts[id] = normalAmount
    }
    for (const id of lessMembers) {
      memberAmounts[id] = lessAmount
    }

    const normalTotal = normalAmount * normalMembers.length
    const lessTotal = lessAmount * lessMembers.length

    // 多めメンバーが残りを負担
    if (moreMembers.length > 0) {
      const remaining = totalAmount - normalTotal - lessTotal
      const perMore = roundUp10(remaining / moreMembers.length)

      for (let i = 0; i < moreMembers.length - 1; i++) {
        memberAmounts[moreMembers[i]] = perMore
      }
      // 最後の多めメンバーは端数調整
      const othersMoreTotal = perMore * (moreMembers.length - 1)
      memberAmounts[moreMembers[moreMembers.length - 1]] = remaining - othersMoreTotal
    } else {
      // 多めがいない場合は会計者が差額を負担
      const currentTotal = normalTotal + lessTotal
      const diff = totalAmount - currentTotal
      memberAmounts[payerId] = (memberAmounts[payerId] || 0) + diff
    }
  } else {
    // Equal split: round up to 10 yen, payer pays remainder
    const perPerson = roundUp10(totalAmount / members.length)
    for (const m of otherMembers) {
      memberAmounts[m.id] = perPerson
    }
    memberAmounts[payerId] = totalAmount - (perPerson * otherMembers.length)
  }

  const paymentValues = otherMembers
    .filter((m) => (memberAmounts[m.id] || 0) > 0)
    .map((m) => ({
      tableId,
      fromMemberId: m.id,
      toMemberId: payerId,
      amount: memberAmounts[m.id],
      splitMode,
    }))

  if (paymentValues.length === 0) {
    tableEvents.emitTableEvent(tableId, "payment:updated", {})
    return NextResponse.json({
      data: [],
      memberAmounts,
      totalAmount,
      memberCount: members.length,
      payerId,
      payerName: payer.displayName,
      splitMode,
      settings,
    })
  }

  const inserted = await db
    .insert(payments)
    .values(paymentValues)
    .returning()

  tableEvents.emitTableEvent(tableId, "payment:updated", {})

  return NextResponse.json({
    data: inserted,
    memberAmounts,
    totalAmount,
    memberCount: members.length,
    payerId,
    payerName: payer.displayName,
    splitMode,
    settings,
  })
}

export async function GET(request: Request) {
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get("tableId")

  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 })
  }

  // Verify membership
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1)

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 })
  }

  // Get table settings
  const [tableRow] = await db
    .select({ settlementSettings: tables.settlementSettings })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1)

  const settings = (tableRow?.settlementSettings as { payerId?: string; splitMode?: string; memberWeights?: Record<string, string> }) || {}

  const paymentsData = await db
    .select({
      id: payments.id,
      tableId: payments.tableId,
      fromMemberId: payments.fromMemberId,
      toMemberId: payments.toMemberId,
      amount: payments.amount,
      isPaid: payments.isPaid,
      paidAt: payments.paidAt,
      splitMode: payments.splitMode,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.tableId, tableId))

  // Get member names
  const memberNames = await db
    .select({ id: tableMembers.id, displayName: tableMembers.displayName })
    .from(tableMembers)
    .where(eq(tableMembers.tableId, tableId))

  const nameMap = Object.fromEntries(memberNames.map((m) => [m.id, m.displayName]))

  // Get order totals
  const allOrders = await db
    .select({ memberId: orders.memberId, lineTotal: orders.lineTotal })
    .from(orders)
    .where(and(eq(orders.tableId, tableId), isNull(orders.deletedAt)))

  const totalAmount = allOrders.reduce((s, o) => s + o.lineTotal, 0)

  // Determine payer
  const payerMemberId = paymentsData.length > 0 ? paymentsData[0].toMemberId : (settings.payerId || null)
  const payerName = payerMemberId ? (nameMap[payerMemberId] ?? "不明") : null

  // Determine split mode
  const recordSplitMode = paymentsData.length > 0
    ? paymentsData[0].splitMode || "equal"
    : (settings.splitMode || "equal")

  // Reconstruct memberAmounts from payment records
  const memberAmounts: Record<string, number> = {}
  for (const p of paymentsData) {
    memberAmounts[p.fromMemberId] = p.amount
  }
  if (payerMemberId) {
    const othersTotal = paymentsData.reduce((s, p) => s + p.amount, 0)
    memberAmounts[payerMemberId] = totalAmount - othersTotal
  }

  const enriched = paymentsData.map((p) => ({
    ...p,
    fromName: nameMap[p.fromMemberId] ?? "不明",
    toName: nameMap[p.toMemberId] ?? "不明",
  }))

  return NextResponse.json({
    data: enriched,
    memberAmounts,
    totalAmount,
    memberCount: memberNames.length,
    payerId: payerMemberId,
    payerName,
    splitMode: recordSplitMode,
    settings,
  })
}
