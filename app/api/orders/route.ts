import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, orders, tableMembers } from "@/lib/db/schema";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";
import { tableEvents } from "@/lib/events/table-events";
import { requireSameOrigin } from "@/lib/security/origin-check";
import { randomUUID } from "crypto";
import { z } from "zod";

// 入力検証: ad-hoc な Number(...) を避け、数値範囲・文字列長を Zod で固める。
const orderInsertSchema = z
  .object({
    table_id: z.string().uuid(),
    member_id: z.string().uuid(),
    member_ids: z.array(z.string().uuid()).max(100).optional(),
    item_name: z.string().trim().max(200).nullable().optional().transform((v) => v ?? null),
    unit_price: z.number().finite().min(0).max(10_000_000),
    quantity: z.number().int().min(1).max(10_000),
    line_total: z.number().finite().min(0).max(100_000_000),
    shared_group_id: z.string().uuid().optional(),
    is_shared: z.boolean().optional(),
  })
  .strict();

const ordersBodySchema = z.object({
  orders: z.array(orderInsertSchema).min(1).max(50),
});

type OrderInsertPayload = z.infer<typeof orderInsertSchema>;

async function resolveUserId(request: Request): Promise<{ userId: string | null; isGuest: boolean }> {
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
      return { userId: dbUser.id, isGuest: false };
    }
  }

  const guestToken = request.headers.get("X-Guest-Token");
  if (guestToken) {
    const guestUserId = await resolveUserIdFromGuestToken(guestToken);
    if (guestUserId) {
      return { userId: guestUserId, isGuest: true };
    }
  }

  return { userId: null, isGuest: false };
}

async function isUserTableMemberDirect(userId: string, tableId: string): Promise<boolean> {
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1);
  return !!member;
}

export async function POST(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  const { userId } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = ordersBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストの内容が不正です", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const ordersList: OrderInsertPayload[] = parsed.data.orders;

  const tableId = ordersList[0]?.table_id;
  if (!tableId || ordersList.some((o) => o.table_id !== tableId)) {
    return NextResponse.json({ error: "Invalid table id" }, { status: 400 });
  }

  // Check table access
  const [table] = await db
    .select({ id: tables.id, ownerUserId: tables.ownerUserId, isArchived: tables.isArchived })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);

  if (table?.isArchived && table.ownerUserId !== userId) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 });
  }

  // Check if user is member
  const isMember = await isUserTableMemberDirect(userId, tableId);
  if (!isMember) {
    return NextResponse.json({ error: "このテーブルのメンバーではありません" }, { status: 403 });
  }

  // 全ての member_id / member_ids が同じテーブルに属していることを保証する。
  // これがないと、自分のメンバーで注文しているふりをして、他テーブルのメンバーに送金が回る。
  const referencedMemberIds = Array.from(
    new Set(
      ordersList.flatMap((o) => [o.member_id, ...(o.member_ids ?? [])]).filter(Boolean),
    ),
  );
  if (referencedMemberIds.length > 0) {
    const membersInTable = await db
      .select({ id: tableMembers.id })
      .from(tableMembers)
      .where(and(eq(tableMembers.tableId, tableId), inArray(tableMembers.id, referencedMemberIds)));
    if (membersInTable.length !== referencedMemberIds.length) {
      return NextResponse.json(
        { error: "指定されたメンバーの一部はこのテーブルに存在しません" },
        { status: 400 },
      );
    }
  }

  try {
    // Expand orders with member_ids into individual orders with shared_group_id
    const expandedOrders: OrderInsertPayload[] = [];
    for (const order of ordersList) {
      if (order.member_ids && order.member_ids.length > 1) {
        const groupId = randomUUID();
        const perPerson = Math.floor(order.line_total / order.member_ids.length);
        const remainder = order.line_total - perPerson * order.member_ids.length;
        for (let i = 0; i < order.member_ids.length; i++) {
          expandedOrders.push({
            ...order,
            member_id: order.member_ids[i],
            line_total: perPerson + (i < remainder ? 1 : 0),
            unit_price: perPerson + (i < remainder ? 1 : 0),
            quantity: 1,
            shared_group_id: groupId,
          });
        }
      } else {
        expandedOrders.push(order);
      }
    }

    const ordersToInsert = expandedOrders.map((order) => ({
      tableId: order.table_id,
      memberId: order.member_id,
      itemName: order.item_name,
      unitPrice: order.unit_price,
      quantity: order.quantity,
      lineTotal: order.line_total,
      isShared: (order as { is_shared?: boolean }).is_shared ?? false,
      sharedGroupId: order.shared_group_id ?? null,
      createdByUserId: userId,
    }));

    const insertedOrders = await db.insert(orders).values(ordersToInsert).returning();

    tableEvents.emitTableEvent(tableId, "order:created", { count: insertedOrders.length });

    return NextResponse.json({ success: true, data: insertedOrders });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Failed to create orders" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { userId } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("tableId");

  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 });
  }

  // Check table access
  const [table] = await db
    .select({ id: tables.id, ownerUserId: tables.ownerUserId, isArchived: tables.isArchived })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);

  if (table?.isArchived && table.ownerUserId !== userId) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 });
  }

  // Check membership
  const isMember = await isUserTableMemberDirect(userId, tableId);
  const isOwner = table?.ownerUserId === userId;

  if (!isMember && !isOwner) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  try {
    const ordersData = await db
      .select({
        id: orders.id,
        tableId: orders.tableId,
        memberId: orders.memberId,
        createdByUserId: orders.createdByUserId,
        itemName: orders.itemName,
        unitPrice: orders.unitPrice,
        quantity: orders.quantity,
        lineTotal: orders.lineTotal,
        isShared: orders.isShared,
        sharedGroupId: orders.sharedGroupId,
        deletedAt: orders.deletedAt,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        member: {
          id: tableMembers.id,
          tableId: tableMembers.tableId,
          userId: tableMembers.userId,
          displayName: tableMembers.displayName,
          isMaster: tableMembers.isMaster,
          isGuest: tableMembers.isGuest,
          joinedAt: tableMembers.joinedAt,
        },
      })
      .from(orders)
      .leftJoin(tableMembers, eq(orders.memberId, tableMembers.id))
      .where(and(eq(orders.tableId, tableId), isNull(orders.deletedAt)))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json({ data: ordersData });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 400 });
  }
}
