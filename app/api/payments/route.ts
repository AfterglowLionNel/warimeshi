import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users, orders, tableMembers, payments, tables } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions"
import { tableEvents } from "@/lib/events/table-events"

// Round up to nearest 10 yen
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

const WEIGHT_MULTIPLIERS = {
  less: 0.5,
  normal: 1,
  more: 1.5,
} as const

const FUN_ADJUSTMENT_TYPES = [
  "none",
  "remainder_roulette",
  "lucky_discount",
  "organizer_bonus",
  "full_burden_roulette",
] as const

type FunAdjustmentType = typeof FUN_ADJUSTMENT_TYPES[number]

type FunAdjustment = {
  type: FunAdjustmentType
  targetMemberId?: string
  amount?: number
}

function normalizeExemptMemberId(value: unknown, memberIds: string[]) {
  return typeof value === "string" && memberIds.includes(value) ? value : null
}

function normalizeFunAdjustment(value: unknown): FunAdjustment {
  if (!value || typeof value !== "object") return { type: "none" }

  const raw = value as Record<string, unknown>
  const type = typeof raw.type === "string" && FUN_ADJUSTMENT_TYPES.includes(raw.type as FunAdjustmentType)
    ? raw.type as FunAdjustmentType
    : "none"

  const targetMemberId = typeof raw.targetMemberId === "string" ? raw.targetMemberId : undefined
  const rawAmount = typeof raw.amount === "number" && Number.isFinite(raw.amount) ? Math.floor(raw.amount) : undefined
  const amount = rawAmount !== undefined && rawAmount > 0 ? Math.min(rawAmount, 10000) : undefined

  if (type === "none") return { type: "none" }
  return { type, targetMemberId, amount }
}

function distributeAmount(memberAmounts: Record<string, number>, memberIds: string[], amount: number) {
  if (amount <= 0 || memberIds.length === 0) return

  const base = Math.floor(amount / memberIds.length)
  let remainder = amount - base * memberIds.length

  for (const id of memberIds) {
    memberAmounts[id] = (memberAmounts[id] || 0) + base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
  }
}

function applyMemberDiscount(
  memberAmounts: Record<string, number>,
  memberIds: string[],
  targetMemberId: string | undefined,
  amount: number,
) {
  if (!targetMemberId || !memberIds.includes(targetMemberId)) return

  const currentAmount = memberAmounts[targetMemberId] || 0
  const discount = Math.min(amount, Math.max(0, currentAmount))
  if (discount <= 0) return

  const recipients = memberIds.filter((id) => id !== targetMemberId)
  if (recipients.length === 0) return

  memberAmounts[targetMemberId] = currentAmount - discount
  distributeAmount(memberAmounts, recipients, discount)
}

function applyMemberExemption(
  memberAmounts: Record<string, number>,
  memberIds: string[],
  exemptMemberId: string | null,
) {
  if (!exemptMemberId || !memberIds.includes(exemptMemberId)) return

  const currentAmount = memberAmounts[exemptMemberId] || 0
  if (currentAmount <= 0) {
    memberAmounts[exemptMemberId] = 0
    return
  }

  memberAmounts[exemptMemberId] = 0
  distributeAmount(memberAmounts, memberIds.filter((id) => id !== exemptMemberId), currentAmount)
}

function applyFunAdjustment(
  memberAmounts: Record<string, number>,
  memberIds: string[],
  funAdjustment: FunAdjustment,
  exemptMemberId: string | null,
) {
  if (funAdjustment.type === "none") return
  const eligibleMemberIds = memberIds.filter((id) => id !== exemptMemberId)
  if (!funAdjustment.targetMemberId || !eligibleMemberIds.includes(funAdjustment.targetMemberId)) return

  if (funAdjustment.type === "full_burden_roulette") {
    const totalAmount = memberIds.reduce((sum, id) => sum + (memberAmounts[id] || 0), 0)
    for (const id of memberIds) {
      memberAmounts[id] = id === funAdjustment.targetMemberId ? totalAmount : 0
    }
    return
  }

  if (funAdjustment.type === "remainder_roulette") {
    const unit = 100
    let carriedAmount = 0

    for (const id of eligibleMemberIds) {
      if (id === funAdjustment.targetMemberId) continue
      const currentAmount = memberAmounts[id] || 0
      if (currentAmount <= 0) continue
      const roundedAmount = Math.floor(currentAmount / unit) * unit
      memberAmounts[id] = roundedAmount
      carriedAmount += currentAmount - roundedAmount
    }

    memberAmounts[funAdjustment.targetMemberId] = (memberAmounts[funAdjustment.targetMemberId] || 0) + carriedAmount
    return
  }

  applyMemberDiscount(memberAmounts, eligibleMemberIds, funAdjustment.targetMemberId, funAdjustment.amount || 500)
}

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
  const funAdjustment = normalizeFunAdjustment(body?.funAdjustment)

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

  // アーカイブ済テーブルの会計を事後改ざんできないようにブロックする
  const [tableState] = await db
    .select({ isArchived: tables.isArchived })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1)

  if (tableState?.isArchived) {
    return NextResponse.json({ error: "アーカイブ済みのテーブルは編集できません" }, { status: 403 })
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

  const memberIds = members.map((m) => m.id)
  const exemptMemberId = normalizeExemptMemberId(body?.exemptMemberId, memberIds)
  const effectiveFunAdjustment =
    funAdjustment.targetMemberId && funAdjustment.targetMemberId === exemptMemberId ? { type: "none" as const } : funAdjustment

  // Save settings to table (shared across all members)
  const settings = { payerId, splitMode, memberWeights, exemptMemberId, funAdjustment: effectiveFunAdjustment }
  await db.update(tables).set({ settlementSettings: settings }).where(eq(tables.id, tableId))

  // Delete all existing payments for this table
  await db.delete(payments).where(eq(payments.tableId, tableId))

  const otherMembers = members.filter((m) => m.id !== payerId)

  // Calculate amounts per member
  const memberAmounts: Record<string, number> = {}

  if (splitMode === "weighted") {
    // UIの表記どおり、多め=1.5 / 普通=1.0 / 少なめ=0.5 の比率で配分する。
    const totalWeight = members.reduce((sum, member) => {
      const key = (memberWeights[member.id] || "normal") as keyof typeof WEIGHT_MULTIPLIERS
      return sum + (WEIGHT_MULTIPLIERS[key] ?? WEIGHT_MULTIPLIERS.normal)
    }, 0)

    const weightedMembers = members.map((m, index) => {
      const weightKey = (memberWeights[m.id] || "normal") as keyof typeof WEIGHT_MULTIPLIERS
      const multiplier = WEIGHT_MULTIPLIERS[weightKey] ?? WEIGHT_MULTIPLIERS.normal
      return {
        id: m.id,
        index,
        rawAmount: (totalAmount * multiplier) / totalWeight,
      }
    })

    let assignedTotal = 0
    for (const memberShare of weightedMembers) {
      const amount = Math.floor(memberShare.rawAmount)
      memberAmounts[memberShare.id] = amount
      assignedTotal += amount
    }

    let remainder = totalAmount - assignedTotal
    const remainderOrder = [...weightedMembers].sort((a, b) => {
      const fractionDiff = (b.rawAmount - Math.floor(b.rawAmount)) - (a.rawAmount - Math.floor(a.rawAmount))
      return fractionDiff || a.index - b.index
    })

    for (const memberShare of remainderOrder) {
      if (remainder <= 0) break
      memberAmounts[memberShare.id] += 1
      remainder -= 1
    }
  } else {
    // Equal split: round up to 10 yen, payer pays remainder
    const perPerson = roundUp10(totalAmount / members.length)
    for (const m of otherMembers) {
      memberAmounts[m.id] = perPerson
    }
    memberAmounts[payerId] = totalAmount - (perPerson * otherMembers.length)
  }

  applyMemberExemption(memberAmounts, memberIds, exemptMemberId)
  applyFunAdjustment(memberAmounts, memberIds, effectiveFunAdjustment, exemptMemberId)

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

  const settings = (tableRow?.settlementSettings as {
    payerId?: string
    splitMode?: string
    memberWeights?: Record<string, string>
    exemptMemberId?: string | null
    funAdjustment?: FunAdjustment
  }) || {}

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
