import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, orders, tableMembers } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";

type OrderInsertPayload = {
  table_id: string;
  member_id: string;
  item_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

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
  const { userId } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ordersList = body?.orders as OrderInsertPayload[] | undefined;

  if (!ordersList || !Array.isArray(ordersList) || ordersList.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

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

  try {
    const ordersToInsert = ordersList.map((order) => ({
      tableId: order.table_id,
      memberId: order.member_id,
      itemName: order.item_name,
      unitPrice: order.unit_price,
      quantity: order.quantity,
      lineTotal: order.line_total,
      createdByUserId: userId,
    }));

    const insertedOrders = await db.insert(orders).values(ordersToInsert).returning();

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
