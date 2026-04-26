import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, orders, tables, tableMembers } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";
import { tableEvents } from "@/lib/events/table-events";

async function resolveUserId(request: Request): Promise<string | null> {
  const session = await auth();

  if (session?.user?.id) {
    let [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!dbUser && session.user.email) {
      [dbUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);
    }

    if (dbUser) {
      return dbUser.id;
    }
  }

  const guestToken = request.headers.get("X-Guest-Token");
  if (guestToken) {
    const guestUserId = await resolveUserIdFromGuestToken(guestToken);
    if (guestUserId) {
      return guestUserId;
    }
  }

  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const updates = body && typeof body === "object" ? ((body as any).updates ?? body) : {};

  if (!orderId) {
    return NextResponse.json({ error: "Invalid payload: order id is required" }, { status: 400 });
  }

  // Get the order
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 });
  }

  // Get table and check permissions
  const [[table], [member]] = await Promise.all([
    db
      .select({ id: tables.id, ownerUserId: tables.ownerUserId, isArchived: tables.isArchived })
      .from(tables)
      .where(eq(tables.id, order.tableId))
      .limit(1),
    db
      .select({ id: tableMembers.id, userId: tableMembers.userId })
      .from(tableMembers)
      .where(eq(tableMembers.id, order.memberId))
      .limit(1),
  ]);

  if (table?.isArchived && table.ownerUserId !== userId) {
    return NextResponse.json({ error: "このテーブルはアーカイブされています" }, { status: 403 });
  }

  const isOwner = table?.ownerUserId === userId;
  const isCreator = order.createdByUserId === userId;
  const isOrderMember = member?.userId === userId;

  if (!isOwner && !isCreator && !isOrderMember) {
    return NextResponse.json({ error: "注文を編集する権限がありません" }, { status: 403 });
  }

  const unitPrice = updates.unit_price !== undefined ? Number(updates.unit_price) : order.unitPrice;
  const quantity = updates.quantity !== undefined ? Number(updates.quantity) : order.quantity;

  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10_000_000) {
    return NextResponse.json({ error: "金額が不正です" }, { status: 400 });
  }

  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
    return NextResponse.json({ error: "数量が不正です" }, { status: 400 });
  }

  // member_id を変更する場合、新しい member が同じ table に所属していることを確認。
  // 検証なしだと他人の注文を別メンバー (別テーブルすら) に付け替えて精算を歪められる。
  let nextMemberId = order.memberId;
  if (updates.member_id !== undefined && updates.member_id !== order.memberId) {
    const requestedMemberId = updates.member_id;
    if (typeof requestedMemberId !== "string") {
      return NextResponse.json({ error: "member_id が不正です" }, { status: 400 });
    }
    const [targetMember] = await db
      .select({ id: tableMembers.id })
      .from(tableMembers)
      .where(and(eq(tableMembers.id, requestedMemberId), eq(tableMembers.tableId, order.tableId)))
      .limit(1);
    if (!targetMember) {
      return NextResponse.json(
        { error: "指定されたメンバーはこのテーブルに存在しません" },
        { status: 400 },
      );
    }
    nextMemberId = requestedMemberId;
  }

  try {
    await db
      .update(orders)
      .set({
        memberId: nextMemberId,
        itemName: updates.item_name ?? order.itemName ?? null,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)));

    tableEvents.emitTableEvent(order.tableId, "order:updated", { orderId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "Order id is required" }, { status: 400 });
  }

  // Get the order to check permissions
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 });
  }

  // Get table ownership
  const [table] = await db
    .select({ ownerUserId: tables.ownerUserId })
    .from(tables)
    .where(eq(tables.id, order.tableId))
    .limit(1);

  const isOwner = table?.ownerUserId === userId;
  const isCreator = order.createdByUserId === userId;

  const [member] = await db
    .select({ userId: tableMembers.userId })
    .from(tableMembers)
    .where(eq(tableMembers.id, order.memberId))
    .limit(1);

  const isOrderMember = member?.userId === userId;

  if (!isOwner && !isCreator && !isOrderMember) {
    return NextResponse.json({ error: "注文を削除する権限がありません" }, { status: 403 });
  }

  try {
    await db
      .update(orders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    tableEvents.emitTableEvent(order.tableId, "order:deleted", { orderId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order deletion error:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 400 });
  }
}
