import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { clientKey, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/origin-check";

const GUEST_TOKEN_EXPIRY_DAYS = 30;
const GUEST_COOKIE_NAME = "wm_guest_token";

const postSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
});

export async function POST(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  // ゲスト作成は IP あたり 1 時間 5 回まで (大量生成 / DoS 防止)
  const limit = rateLimit(clientKey(request, "guest-create"), { windowSec: 3600, max: 5 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "ゲスト作成の試行回数が上限に達しました。しばらく経ってからお試しください。" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const displayName = parsed.data.displayName;

  const guestToken = crypto.randomUUID();
  const guestTokenExpiresAt = new Date(Date.now() + GUEST_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const nickname = displayName || "ゲスト";

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

    const response = NextResponse.json({
      guestToken: newUser.guestToken,
      userId: newUser.id,
    });

    // HttpOnly Cookie に同じ guestToken を保存。
    // /api/auth/link-guest はこの cookie 値と body の guestToken が一致した時のみデータ移管を許可する。
    // localStorage 単体では他人のトークンを攻撃者が body に詰めて乗っ取れてしまうため。
    if (newUser.guestToken) {
      response.cookies.set(GUEST_COOKIE_NAME, newUser.guestToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: GUEST_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      });
    }

    return response;
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
