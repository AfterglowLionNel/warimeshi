import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const GUEST_TOKEN_EXPIRY_DAYS = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const displayName = body?.displayName as string | undefined;

  const guestToken = crypto.randomUUID();
  const guestTokenExpiresAt = new Date(Date.now() + GUEST_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const nickname = displayName?.trim() || "ゲスト";

  try {
    const [newUser] = await db
      .insert(users)
      .values({
        nickname,
        isGuestUser: true,
        guestToken,
        guestTokenExpiresAt,
      })
      .returning({ id: users.id, guestToken: users.guestToken });

    if (!newUser) {
      return NextResponse.json({ error: "Failed to create guest user" }, { status: 400 });
    }

    return NextResponse.json({
      guestToken: newUser.guestToken,
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Guest user creation error:", error);
    return NextResponse.json({ error: "Failed to create guest session" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guestToken = searchParams.get("token");

  if (!guestToken) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const [guestUser] = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        isGuestUser: users.isGuestUser,
        guestTokenExpiresAt: users.guestTokenExpiresAt,
      })
      .from(users)
      .where(eq(users.guestToken, guestToken))
      .limit(1);

    if (!guestUser) {
      return NextResponse.json({ error: "Invalid guest token" }, { status: 404 });
    }

    if (!guestUser.isGuestUser) {
      return NextResponse.json({ error: "Token is not for a guest user" }, { status: 400 });
    }

    if (guestUser.guestTokenExpiresAt && new Date(guestUser.guestTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Guest token expired" }, { status: 401 });
    }

    return NextResponse.json({
      userId: guestUser.id,
      nickname: guestUser.nickname,
      valid: true,
    });
  } catch (error) {
    console.error("Guest token validation error:", error);
    return NextResponse.json({ error: "Failed to validate guest token" }, { status: 500 });
  }
}
