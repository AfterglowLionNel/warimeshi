import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSameOrigin } from "@/lib/security/origin-check";

const patchSchema = z.object({
  nickname: z.string().trim().max(50),
});

export async function PATCH(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const nickname = parsed.data.nickname;

  try {
    // Try to update by session ID first
    const result = await db
      .update(users)
      .set({
        nickname: nickname || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({ id: users.id });

    // If no rows updated and we have email, try by email
    if (result.length === 0 && session.user.email) {
      await db
        .update(users)
        .set({
          nickname: nickname || null,
          updatedAt: new Date(),
        })
        .where(eq(users.email, session.user.email));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let [dbUser] = await db
    .select({ id: users.id, nickname: users.nickname, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Fallback to email search if user not found by ID
  if (!dbUser && session.user.email) {
    [dbUser] = await db
      .select({ id: users.id, nickname: users.nickname, email: users.email, image: users.image })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
  }

  return NextResponse.json({
    id: dbUser?.id ?? session.user.id,
    email: session.user.email ?? dbUser?.email,
    nickname: dbUser?.nickname ?? null,
    image: session.user.image ?? dbUser?.image ?? null,
  });
}
