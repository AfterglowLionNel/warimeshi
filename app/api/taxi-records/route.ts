import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, taxiRecords } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isUserTableMember } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/origin-check";

const fareSettingsSchema = z.object({
  baseKm: z.number().nonnegative(),
  basePrice: z.number().nonnegative(),
  perKmPrice: z.number().nonnegative(),
  extraFromKm: z.number().nonnegative().optional(),
  extraPerKm: z.number().nonnegative().optional(),
  pickupFee: z.number().nonnegative(),
});

const postSchema = z.object({
  tableId: z.string().uuid(),
  vehicleType: z.enum(["taxi", "daiko"]),
  mode: z.enum(["total", "same", "segments"]),
  settings: fareSettingsSchema,
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const data = parsed.data;

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

  if (!dbUser) {
    return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 400 });
  }

  // Check if user is member
  const isMember = await isUserTableMember(session.user.id, data.tableId, session.user.email);
  if (!isMember) {
    return NextResponse.json({ error: "このテーブルのメンバーではありません" }, { status: 403 });
  }

  try {
    const [inserted] = await db
      .insert(taxiRecords)
      .values({
        tableId: data.tableId,
        createdByUserId: dbUser.id,
        vehicleType: data.vehicleType,
        mode: data.mode,
        settings: data.settings,
        input: data.input,
        result: data.result,
      })
      .returning();

    return NextResponse.json({ success: true, data: inserted });
  } catch (error) {
    console.error("Taxi record creation error:", error);
    return NextResponse.json({ error: "Failed to create taxi record" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tableId = searchParams.get("tableId");

  if (!tableId) {
    return NextResponse.json({ error: "tableId is required" }, { status: 400 });
  }

  // Check if user is member
  const isMember = await isUserTableMember(session.user.id, tableId, session.user.email);
  if (!isMember) {
    return NextResponse.json({ error: "このテーブルのメンバーではありません" }, { status: 403 });
  }

  try {
    const [data] = await db
      .select()
      .from(taxiRecords)
      .where(eq(taxiRecords.tableId, tableId))
      .orderBy(desc(taxiRecords.createdAt))
      .limit(1);

    return NextResponse.json({ data: data ?? null });
  } catch (error) {
    console.error("Taxi records fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch taxi records" }, { status: 400 });
  }
}
