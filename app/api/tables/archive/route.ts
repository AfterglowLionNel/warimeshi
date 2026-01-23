import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";

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

export async function POST(request: Request) {
  const userId = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tableId = body?.tableId as string | undefined;
  const archive = body?.archive as boolean | undefined;

  if (!tableId || typeof archive !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Check ownership
  const isOwner = await isTableOwner(userId, tableId);
  if (!isOwner) {
    return NextResponse.json({ error: "テーブルをアーカイブする権限がありません" }, { status: 403 });
  }

  try {
    await db
      .update(tables)
      .set({
        isArchived: archive,
        archivedAt: archive ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(tables.id, tableId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Archive error:", error);
    return NextResponse.json({ error: "Failed to update archive status" }, { status: 400 });
  }
}
