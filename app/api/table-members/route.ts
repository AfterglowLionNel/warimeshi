import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";
import { tableEvents } from "@/lib/events/table-events";
import bcrypt from "bcryptjs";
import { decryptInvitePassword, isEncryptedInvitePassword } from "@/lib/crypto/invite-password";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { z } from "zod";

const joinMemberSchema = z
  .object({
    tableId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(50),
    invitePassword: z.string().trim().min(1).max(64).optional(),
    isGuest: z.boolean().optional().default(false),
  })
  .strict();

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

async function isUserTableMemberWithGuest(userId: string, tableId: string, _isGuestUser: boolean): Promise<boolean> {
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

  const rawBody = await request.json().catch(() => null);
  const parsed = joinMemberSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストの内容が不正です", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const { tableId, displayName, invitePassword, isGuest } = parsed.data;

  // 招待パスワード総当たり対策: 同一 IP + 同一テーブルへの参加試行を 1 分 10 回まで
  const limit = rateLimit(clientKey(request, `member-join:${tableId}`), { windowSec: 60, max: 10 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらく経ってから再度お試しください。" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }


  // Ensure table exists and check archive/owner/lock status
  const [table] = await db
    .select({
      id: tables.id,
      ownerUserId: tables.ownerUserId,
      invitePassword: tables.invitePassword,
      inviteTokenExpiresAt: tables.inviteTokenExpiresAt,
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

  const isOwner = table.ownerUserId === userId;

  // 招待トークンの有効期限チェック（オーナーはバイパス可能）
  if (!isOwner && table.inviteTokenExpiresAt && new Date(table.inviteTokenExpiresAt) < new Date()) {
    return NextResponse.json({ error: "招待リンクの有効期限が切れています" }, { status: 403 });
  }

  if (table.isArchived && !isOwner) {
    return NextResponse.json({ error: "This table is archived" }, { status: 403 });
  }

  // Check if table is locked (either manually or auto-locked)
  // オーナーはロックをバイパスできる
  const isAutoLocked = table.autoLockAt && new Date(table.autoLockAt) < new Date();
  if ((table.isLocked || isAutoLocked) && !isOwner) {
    return NextResponse.json({ error: "このセッションは参加を締め切りました" }, { status: 403 });
  }

  // Check invite password (only for non-owner regular joins)
  if (table.invitePassword && !isOwner && !isGuest) {
    if (!invitePassword) {
      return NextResponse.json({ error: "招待パスワードが正しくありません" }, { status: 403 });
    }
    const normalizedInput = invitePassword.trim().toUpperCase();
    let isValid = false;
    if (isEncryptedInvitePassword(table.invitePassword)) {
      const decrypted = decryptInvitePassword(table.invitePassword);
      isValid = decrypted !== null && normalizedInput === decrypted.toUpperCase();
    } else if (table.invitePassword.startsWith("$2")) {
      // 旧 bcrypt 形式 (移行期間用に残置)
      isValid = await bcrypt.compare(normalizedInput, table.invitePassword);
    } else {
      // 旧平文形式 (移行期間用に残置)
      isValid = normalizedInput === table.invitePassword.toUpperCase();
    }
    if (!isValid) {
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
        displayName,
        isMaster: false,
        isGuest: true,
        addedByUserId: userId,
      }).returning({ id: tableMembers.id });

      tableEvents.emitTableEvent(tableId, "member:joined", { memberId: newMember.id });
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
        displayName,
        isMaster: false,
        isGuest: isGuestUser,
        addedByUserId: null,
      });

      tableEvents.emitTableEvent(tableId, "member:joined", { userId });
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
    tableEvents.emitTableEvent(member.tableId, "member:left", { memberId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member deletion error:", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 400 });
  }
}
