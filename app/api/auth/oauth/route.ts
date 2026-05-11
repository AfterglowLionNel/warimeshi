import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/origin-check";

// callbackUrl は同一オリジン内の相対パスのみ許可 (Open Redirect 防止)
const postSchema = z.object({
  provider: z.enum(["google", "line"]),
  callbackUrl: z
    .string()
    .refine(
      (v) => v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\"),
      { message: "callbackUrl must be a same-origin relative path" },
    )
    .optional(),
});

export async function POST(request: Request) {
  const originFail = requireSameOrigin(request);
  if (originFail) return originFail;

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "サポートされていないプロバイダーです" }, { status: 400 });
  }

  const { provider, callbackUrl = "/group" } = parsed.data;

  // Return the Auth.js OAuth URL
  const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com";
  const params = new URLSearchParams({
    callbackUrl,
  });
  const url = `${baseUrl}/api/auth/signin/${provider}?${params.toString()}`;

  return NextResponse.json({ url });
}
