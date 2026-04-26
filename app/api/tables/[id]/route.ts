import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";
import { generateInviteToken } from "@/lib/utils/format";

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

async function isTableOwner(userId: string, tableId: string): Promise<boolean> {
  const [table] = await db
    .select({ ownerUserId: tables.ownerUserId })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);

  return table?.ownerUserId === userId;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tableId } = await params;
  if (!tableId) {
    return NextResponse.json({ error: "Table id is required" }, { status: 400 });
  }

  // Check ownership
  const isOwner = await isTableOwner(userId, tableId);
  if (!isOwner) {
    return NextResponse.json({ error: "テーブルを削除する権限がありません" }, { status: 403 });
  }

  try {
    await db.delete(tables).where(eq(tables.id, tableId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Table deletion error:", error);
    return NextResponse.json({ error: "Failed to delete table" }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tableId } = await params;
  if (!tableId) {
    return NextResponse.json({ error: "Table id is required" }, { status: 400 });
  }

  // Check ownership
  const isOwner = await isTableOwner(userId, tableId);
  if (!isOwner) {
    return NextResponse.json({ error: "この操作を行う権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = {};

    // Handle lock toggle
    if (typeof body.isLocked === "boolean") {
      updates.isLocked = body.isLocked;
      // If unlocking, also reset autoLockAt to 12 hours from now
      if (!body.isLocked) {
        updates.autoLockAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      }
    }

    // Handle manual autoLockAt update
    if (body.autoLockAt !== undefined) {
      updates.autoLockAt = body.autoLockAt ? new Date(body.autoLockAt) : null;
    }

    // Handle invite token regeneration (invalidates old token)
    let newInviteToken: string | undefined;
    if (body.regenerateInviteToken === true) {
      newInviteToken = generateInviteToken();
      updates.inviteToken = newInviteToken;
      // Reset expiration to 7 days from now
      updates.inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    updates.updatedAt = new Date();

    await db.update(tables).set(updates).where(eq(tables.id, tableId));

    // Fetch updated table to return
    const [updatedTable] = await db
      .select({
        id: tables.id,
        isLocked: tables.isLocked,
        autoLockAt: tables.autoLockAt,
        inviteToken: tables.inviteToken,
        inviteTokenExpiresAt: tables.inviteTokenExpiresAt,
      })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    return NextResponse.json({
      success: true,
      isLocked: updatedTable.isLocked,
      autoLockAt: updatedTable.autoLockAt?.toISOString() ?? null,
      inviteToken: newInviteToken ? updatedTable.inviteToken : undefined,
      inviteTokenExpiresAt: newInviteToken ? updatedTable.inviteTokenExpiresAt?.toISOString() : undefined,
    });
  } catch (error) {
    console.error("Table update error:", error);
    return NextResponse.json({ error: "Failed to update table" }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tableId } = await params;
  if (!tableId) {
    return NextResponse.json({ error: "Table id is required" }, { status: 400 });
  }

  try {
    const [table] = await db
      .select({
        id: tables.id,
        ownerUserId: tables.ownerUserId,
        name: tables.name,
        eventDate: tables.eventDate,
        inviteToken: tables.inviteToken,
        isArchived: tables.isArchived,
        archivedAt: tables.archivedAt,
        isLocked: tables.isLocked,
        autoLockAt: tables.autoLockAt,
        createdAt: tables.createdAt,
        updatedAt: tables.updatedAt,
      })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: table.id,
      owner_user_id: table.ownerUserId,
      name: table.name,
      event_date: table.eventDate.toISOString().split("T")[0],
      invite_token: table.inviteToken,
      is_archived: table.isArchived,
      archived_at: table.archivedAt?.toISOString() ?? null,
      is_locked: table.isLocked,
      auto_lock_at: table.autoLockAt?.toISOString() ?? null,
      created_at: table.createdAt.toISOString(),
      updated_at: table.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Table fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch table" }, { status: 400 });
  }
}
