import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { generateInviteToken } from "@/lib/utils/format";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";

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

function generateInvitePassword(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;

  // Ensure at least one letter and one digit
  let password = "";
  password += letters[Math.floor(Math.random() * letters.length)];
  password += digits[Math.floor(Math.random() * digits.length)];

  // Fill remaining 2 characters
  for (let i = 0; i < 2; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the characters
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

export async function POST(request: Request) {
  const { userId, isGuest } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tableName = body?.tableName as string | undefined;
  const eventDate = body?.eventDate as string | undefined;
  const displayName = body?.displayName as string | undefined;
  const usePassword = body?.usePassword === true;

  if (!tableName || !eventDate || !displayName) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inviteToken = generateInviteToken();
  const autoLockAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const invitePassword = usePassword ? generateInvitePassword() : null;

  try {
    const [newTable] = await db
      .insert(tables)
      .values({
        ownerUserId: userId,
        name: tableName.trim(),
        eventDate: new Date(eventDate),
        inviteToken,
        invitePassword,
        autoLockAt,
      })
      .returning();

    if (!newTable) {
      return NextResponse.json({ error: "Failed to create table" }, { status: 400 });
    }

    await db.insert(tableMembers).values({
      tableId: newTable.id,
      userId: userId,
      displayName: displayName.trim(),
      isMaster: true,
      isGuest: isGuest,
    });

    return NextResponse.json({ success: true, inviteToken });
  } catch (error) {
    console.error("Table creation error:", error);
    return NextResponse.json({ error: "Failed to create table" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { userId } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const memberships = await db
      .select({
        tableId: tableMembers.tableId,
        isMaster: tableMembers.isMaster,
      })
      .from(tableMembers)
      .where(eq(tableMembers.userId, userId));

    const tableIds = memberships.map((m) => m.tableId);

    if (tableIds.length === 0) {
      return NextResponse.json({ tables: [] });
    }

    const tablesData = await db
      .select()
      .from(tables)
      .where(inArray(tables.id, tableIds))
      .orderBy(desc(tables.eventDate));

    const memberCounts = await Promise.all(
      tablesData.map(async (table) => {
        const members = await db
          .select({ id: tableMembers.id })
          .from(tableMembers)
          .where(eq(tableMembers.tableId, table.id));
        return { tableId: table.id, count: members.length };
      })
    );

    const tablesWithDetails = tablesData.map((table) => {
      const membership = memberships.find((m) => m.tableId === table.id);
      const countData = memberCounts.find((c) => c.tableId === table.id);
      return {
        id: table.id,
        name: table.name,
        event_date: table.eventDate.toISOString().split("T")[0],
        invite_token: table.inviteToken,
        is_archived: table.isArchived,
        is_master: membership?.isMaster || false,
        member_count: countData?.count || 0,
      };
    });

    return NextResponse.json({ tables: tablesWithDetails });
  } catch (error) {
    console.error("Tables fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}
