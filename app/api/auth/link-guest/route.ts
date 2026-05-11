import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tables, tableMembers, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSameOrigin } from "@/lib/security/origin-check";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

const GUEST_COOKIE_NAME = "wm_guest_token";

// guestToken は randomUUID 由来の UUID v4。形式を絞ることで雑な brute force を弾く。
const postSchema = z.object({
  guestToken: z.string().uuid(),
});

export async function POST(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  // ゲスト紐付けは IP あたり 1 時間 10 回まで (ブルートフォース防止)
  const limit = await rateLimit(clientKey(request, "link-guest"), { windowSec: 3600, max: 10 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "試行回数が上限に達しました。しばらく経ってからお試しください。" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized - must be logged in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const guestToken = parsed.data.guestToken;

  // 所有権検証: HttpOnly Cookie に保存された guestToken と body の guestToken が一致することを要求。
  // これにより、他人の guestToken を入手しただけでは link-guest 経由でデータを乗っ取れない。
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (!cookieToken || cookieToken !== guestToken) {
    return NextResponse.json(
      { error: "ゲストトークンの所有者として確認できませんでした。ゲストとして利用していたデバイスからログインしてリンクしてください。" },
      { status: 403 },
    );
  }

  // Find the authenticated user in DB
  let [authenticatedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!authenticatedUser && session.user.email) {
    [authenticatedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
  }

  if (!authenticatedUser) {
    return NextResponse.json({ error: "Authenticated user not found" }, { status: 400 });
  }

  // Find the guest user by token
  const [guestUser] = await db
    .select({
      id: users.id,
      isGuestUser: users.isGuestUser,
      guestTokenExpiresAt: users.guestTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.guestToken, guestToken))
    .limit(1);

  if (!guestUser) {
    return NextResponse.json({ error: "Guest user not found" }, { status: 404 });
  }

  if (!guestUser.isGuestUser) {
    return NextResponse.json({ error: "Token does not belong to a guest user" }, { status: 400 });
  }

  if (guestUser.guestTokenExpiresAt && new Date(guestUser.guestTokenExpiresAt) < new Date()) {
    return NextResponse.json({ error: "Guest token has expired" }, { status: 401 });
  }

  // If it's the same user, just clear the guest status
  if (guestUser.id === authenticatedUser.id) {
    await db
      .update(users)
      .set({
        isGuestUser: false,
        guestToken: null,
        guestTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, guestUser.id));

    const sameUserResponse = NextResponse.json({
      success: true,
      message: "Guest status cleared",
      migratedTables: 0,
      migratedMemberships: 0,
      migratedOrders: 0,
    });
    sameUserResponse.cookies.delete(GUEST_COOKIE_NAME);
    return sameUserResponse;
  }

  try {
    // Migrate all data from guest user to authenticated user
    // 1. Update tables owned by guest user
    const updatedTables = await db
      .update(tables)
      .set({ ownerUserId: authenticatedUser.id, updatedAt: new Date() })
      .where(eq(tables.ownerUserId, guestUser.id))
      .returning({ id: tables.id });

    // 2. Update table memberships
    const updatedMemberships = await db
      .update(tableMembers)
      .set({ userId: authenticatedUser.id })
      .where(eq(tableMembers.userId, guestUser.id))
      .returning({ id: tableMembers.id });

    // 3. Update addedByUserId references
    await db
      .update(tableMembers)
      .set({ addedByUserId: authenticatedUser.id })
      .where(eq(tableMembers.addedByUserId, guestUser.id));

    // 4. Update orders created by guest user
    const updatedOrders = await db
      .update(orders)
      .set({ createdByUserId: authenticatedUser.id, updatedAt: new Date() })
      .where(eq(orders.createdByUserId, guestUser.id))
      .returning({ id: orders.id });

    // 5. Delete the guest user record
    await db.delete(users).where(eq(users.id, guestUser.id));

    const response = NextResponse.json({
      success: true,
      message: "Guest data successfully linked to your account",
      migratedTables: updatedTables.length,
      migratedMemberships: updatedMemberships.length,
      migratedOrders: updatedOrders.length,
    });
    // 移管完了後は所有権 Cookie を削除し、再利用 (リプレイ) を防ぐ。
    response.cookies.delete(GUEST_COOKIE_NAME);
    return response;
  } catch (error) {
    console.error("Link guest error:", error);
    return NextResponse.json({ error: "Failed to link guest account" }, { status: 500 });
  }
}
