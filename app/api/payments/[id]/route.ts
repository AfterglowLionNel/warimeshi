import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users, payments, tableMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions"
import { tableEvents } from "@/lib/events/table-events"
import { requireSameOrigin } from "@/lib/security/origin-check"

const patchSchema = z.object({
  isPaid: z.boolean(),
})

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFail = requireSameOrigin(request)
  if (originFail) return originFail

  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: paymentId } = await params
  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { isPaid } = parsed.data

  // Get payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  // Verify user is a member of this table
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, payment.tableId), eq(tableMembers.userId, userId)))
    .limit(1)

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 })
  }

  await db
    .update(payments)
    .set({
      isPaid,
      paidAt: isPaid ? new Date() : null,
    })
    .where(eq(payments.id, paymentId))

  tableEvents.emitTableEvent(payment.tableId, "payment:updated", { paymentId, isPaid })

  return NextResponse.json({ success: true })
}
