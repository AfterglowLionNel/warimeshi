import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { isUserTableMember, isUserTableOwner, resolveDbUserId, resolveUserIdFromGuestToken } from "@/lib/auth/permissions";

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

async function isUserTableMemberWithGuest(userId: string, tableId: string, isGuestUser: boolean): Promise<boolean> {
  const [member] = await db
    .select({ id: tableMembers.id })
    .from(tableMembers)
    .where(and(eq(tableMembers.tableId, tableId), eq(tableMembers.userId, userId)))
    .limit(1);

  return !!member;
}

export async function POST(request: Request) {
  const { userId, isGuest: isGuestUser } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tableId = body?.tableId as string | undefined;
  const displayName = body?.displayName as string | undefined;
  const invitePassword = body?.invitePassword as string | undefined;
  const isGuest = body?.isGuest === true;

  if (!tableId || !displayName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Ensure table exists and check archive/owner/lock status
  const [table] = await db
    .select({
      id: tables.id,
      ownerUserId: tables.ownerUserId,
      invitePassword: tables.invitePassword,
      isArchived: tables.isArchived,
      isLocked: tables.isLocked,
      autoLockAt: tables.autoLockAt,
    })
    .from(tables)
    .where(eq(tables.id, tableId))
    .limit(1);

  if (!table) {
    return NextResponse.json({ error: "テーブルが見つかりません" }, { status: 404 });
  }

  if (table.isArchived && table.ownerUserId !== userId) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 });
  }

  // Check if table is locked (either manually or auto-locked)
  // オーナーはロックをバイパスできる
  const isOwner = table.ownerUserId === userId;
  const isAutoLocked = table.autoLockAt && new Date(table.autoLockAt) < new Date();
  if ((table.isLocked || isAutoLocked) && !isOwner) {
    return NextResponse.json({ error: "このセッションは参加を締め切りました" }, { status: 403 });
  }

  // Check invite password (only for non-owner regular joins)
  if (table.invitePassword && !isOwner && !isGuest) {
    if (!invitePassword || invitePassword.trim().toUpperCase() !== table.invitePassword.toUpperCase()) {
      return NextResponse.json({ error: "招待パスワードが正しくありません" }, { status: 403 });
    }
  }

  if (isGuest) {
    // Guest member creation - caller must already be a member
    const isMember = await isUserTableMemberWithGuest(userId, tableId, isGuestUser);
    if (!isMember) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }

    try {
      const [newMember] = await db.insert(tableMembers).values({
        tableId,
        userId: null, // Guest members don't have a user account
        displayName: displayName.trim(),
        isMaster: false,
        isGuest: true,
        addedByUserId: userId,
      }).returning({ id: tableMembers.id });

      return NextResponse.json({ success: true, memberId: newMember.id });
    } catch (error) {
      console.error("Guest member creation error:", error);
      return NextResponse.json({ error: "Failed to add guest member" }, { status: 400 });
    }
  } else {
    // Regular member join - check if already a member
    const alreadyMember = await isUserTableMemberWithGuest(userId, tableId, isGuestUser);
    if (alreadyMember) {
      return NextResponse.json({ error: "既にこのテーブルのメンバーです" }, { status: 400 });
    }

    try {
      await db.insert(tableMembers).values({
        tableId,
        userId: userId,
        displayName: displayName.trim(),
        isMaster: false,
        isGuest: isGuestUser,
        addedByUserId: null,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Member creation error:", error);
      return NextResponse.json({ error: "Failed to add member" }, { status: 400 });
    }
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

  if (!table) {
    return NextResponse.json({ error: "テーブルが見つかりません" }, { status: 404 });
  }

  const isMember = await isUserTableMemberWithGuest(userId, tableId, false);
  const isOwner = table.ownerUserId === userId;

  if (table.isArchived && !isOwner) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 });
  }

  if (!isMember && !isOwner) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  try {
    const members = await db
      .select({
        id: tableMembers.id,
        tableId: tableMembers.tableId,
        userId: tableMembers.userId,
        displayName: tableMembers.displayName,
        isMaster: tableMembers.isMaster,
        isGuest: tableMembers.isGuest,
        addedByUserId: tableMembers.addedByUserId,
        joinedAt: tableMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          nickname: users.nickname,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(tableMembers)
      .leftJoin(users, eq(tableMembers.userId, users.id))
      .where(eq(tableMembers.tableId, tableId))
      .orderBy(asc(tableMembers.joinedAt));

    return NextResponse.json({ data: members });
  } catch (error) {
    console.error("Members fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  // Get the member info
  const [member] = await db
    .select({
      id: tableMembers.id,
      tableId: tableMembers.tableId,
      userId: tableMembers.userId,
      isGuest: tableMembers.isGuest,
      addedByUserId: tableMembers.addedByUserId,
      isMaster: tableMembers.isMaster,
    })
    .from(tableMembers)
    .where(eq(tableMembers.id, memberId))
    .limit(1);

  if (!member) {
    return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
  }

  // Can't delete master member
  if (member.isMaster) {
    return NextResponse.json({ error: "オーナーは削除できません" }, { status: 403 });
  }

  // Check table ownership
  const [table] = await db
    .select({ ownerUserId: tables.ownerUserId })
    .from(tables)
    .where(eq(tables.id, member.tableId))
    .limit(1);

  const isOwner = table?.ownerUserId === userId;

  // For guest members: only the person who added them or the table owner can delete
  if (member.isGuest) {
    const canDelete = isOwner || member.addedByUserId === userId;
    if (!canDelete) {
      return NextResponse.json({ error: "このゲストを削除する権限がありません" }, { status: 403 });
    }
  } else {
    // For regular members: only the table owner or the member themselves can delete
    const canDelete = isOwner || member.userId === userId;
    if (!canDelete) {
      return NextResponse.json({ error: "このメンバーを削除する権限がありません" }, { status: 403 });
    }
  }

  try {
    await db.delete(tableMembers).where(eq(tableMembers.id, memberId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member deletion error:", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 400 });
  }
}
