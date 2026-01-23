import { NextResponse } from "next/server";

const allowedProviders = ["google", "line"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const provider = body?.provider as string | undefined;
  const callbackUrl = body?.callbackUrl ?? "/group";

  if (!provider || !allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "サポートされていないプロバイダーです" }, { status: 400 });
  }

  // Return the Auth.js OAuth URL
  const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://warimeshi.com";
  const params = new URLSearchParams({
    callbackUrl,
  });
  const url = `${baseUrl}/api/auth/signin/${provider}?${params.toString()}`;

  return NextResponse.json({ url });
}
