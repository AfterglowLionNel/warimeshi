import type { CookieOptions } from "@supabase/ssr"

function resolveSiteInfo() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) return { isHttps: false, domain: undefined }

  try {
    const url = new URL(siteUrl)
    const domain = url.hostname
    const isHttps = url.protocol === "https:"
    return { isHttps, domain }
  } catch {
    return { isHttps: false, domain: undefined }
  }
}

export function getAuthCookieOptions(): CookieOptions {
  const { isHttps, domain } = resolveSiteInfo()
  const isLocalDomain = !domain || domain === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(domain)

  const useSecureCookies = isHttps || process.env.NODE_ENV === "production"
  // XSS でのクロスサイト送信を防ぐため SameSite を Lax に固定する
  const sameSite: CookieOptions["sameSite"] = "lax"

  // Domain を省略し、ホスト限定クッキーにする（アクセスしているホストに合わせて送信されるため、
  // ローカル / 本番の両方でセッションが途切れにくくなる）。
  return {
    path: "/",
    sameSite,
    secure: useSecureCookies,
    httpOnly: true,
    ...(isLocalDomain ? {} : { domain }),
  }
}
