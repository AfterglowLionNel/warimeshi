import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { generateInviteToken } from "@/lib/utils/format";
import { resolveUserIdFromGuestToken } from "@/lib/auth/permissions";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createTableSchema = z
  .object({
    tableName: z.string().trim().min(1).max(100),
    // ISO 8601 形式の日時文字列
    eventDate: z.string().datetime({ offset: true }).or(z.string().min(8).max(40)),
    displayName: z.string().trim().min(1).max(50),
    usePassword: z.boolean().optional().default(false),
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

function generateInvitePassword(length = 8): string {
  // 紛らわしい文字 (I, L, O, 0, 1) を除外
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;

  if (length < 4) throw new Error("Password length must be >= 4");

  // CSPRNG でインデックスを引く (modulo bias を避けるため十分な範囲を引いてから余りを取る)
  const pickIndex = (max: number): number => {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / max) * max;
    let value: number;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  };

  const chars: string[] = [];
  // 最低 1 文字ずつ英字と数字を保証
  chars.push(letters[pickIndex(letters.length)]);
  chars.push(digits[pickIndex(digits.length)]);
  for (let i = chars.length; i < length; i++) {
    chars.push(all[pickIndex(all.length)]);
  }

  // Fisher-Yates シャッフル (CSPRNG)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export async function POST(request: Request) {
  const { userId, isGuest } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createTableSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストの内容が不正です", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }
  const { tableName, eventDate, displayName, usePassword } = parsed.data;

  // eventDate を Date に変換 (Invalid Date を弾く)
  const eventDateObj = new Date(eventDate);
  if (Number.isNaN(eventDateObj.getTime())) {
    return NextResponse.json({ error: "eventDate が不正な日付です" }, { status: 400 });
  }

  const inviteToken = generateInviteToken();
  const autoLockAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  // 招待トークンの有効期限（デフォルト7日間）
  const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const plainPassword = usePassword ? generateInvitePassword() : null;
  // ハッシュ化して保存（大文字変換後にハッシュ化）
  const hashedPassword = plainPassword ? await bcrypt.hash(plainPassword.toUpperCase(), 10) : null;

  try {
    const [newTable] = await db
      .insert(tables)
      .values({
        ownerUserId: userId,
        name: tableName,
        eventDate: eventDateObj,
        inviteToken,
        inviteTokenExpiresAt,
        invitePassword: hashedPassword,
        autoLockAt,
      })
      .returning();

    if (!newTable) {
      return NextResponse.json({ error: "Failed to create table" }, { status: 400 });
    }

    await db.insert(tableMembers).values({
      tableId: newTable.id,
      userId: userId,
      displayName,
      isMaster: true,
      isGuest: isGuest,
    });

    return NextResponse.json({ success: true, inviteToken, invitePassword: plainPassword });
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
