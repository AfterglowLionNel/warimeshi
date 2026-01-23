import { signOut } from "@/lib/auth";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const envOrigin = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const rawHost = request.headers.get("host");
  const proto = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;

  const candidates = [
    envOrigin,
    forwardedHost ? `${proto}//${forwardedHost}` : null,
    rawHost ? `${proto}//${rawHost}` : null,
    requestUrl.origin,
  ];
  const origin =
    candidates.find((v) => v && !v.includes("0.0.0.0")) ??
    candidates.find(Boolean) ??
    requestUrl.origin;

  await signOut({ redirect: false });

  // Revalidate cached pages
  revalidatePath("/");
  revalidatePath("/group");

  const response = NextResponse.redirect(origin);
  // Prevent caching
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}
