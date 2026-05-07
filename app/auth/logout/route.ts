import { signOut } from "@/lib/auth";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.state",
  "__Secure-authjs.state",
  "authjs.nonce",
  "__Secure-authjs.nonce",
];

function resolveOrigin(request: Request) {
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

  return origin;
}

function clearAuthCookies(response: NextResponse, request: Request) {
  const requestUrl = new URL(request.url);
  const isSecureRequest =
    requestUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  for (const name of AUTH_COOKIE_NAMES) {
    const secure = isSecureRequest || name.startsWith("__");
    const options = {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax" as const,
      secure,
    };

    response.cookies.set(name, "", options);
    for (let i = 0; i < 8; i += 1) {
      response.cookies.set(`${name}.${i}`, "", options);
    }
  }
}

function addLogoutHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}

async function clearServerSession() {
  await signOut({ redirect: false });

  revalidatePath("/");
  revalidatePath("/group");
  revalidatePath("/settings");
}

export async function GET(request: Request) {
  await clearServerSession();

  const response = NextResponse.redirect(new URL("/", resolveOrigin(request)));
  clearAuthCookies(response, request);
  return addLogoutHeaders(response);
}

export async function POST(request: Request) {
  await clearServerSession();

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response, request);
  return addLogoutHeaders(response);
}
