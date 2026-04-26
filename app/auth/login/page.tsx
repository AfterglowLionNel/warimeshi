"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2, Sparkles, ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get("redirect")
  const callbackUrl = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/group"

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then(res => res.json())
      .then(data => setCsrfToken(data.csrfToken))
      .catch(err => console.error("Failed to get CSRF token:", err))
  }, [])

  return (
    <div className="min-h-svh w-full bg-background">
      <div className="mx-auto w-full max-w-sm px-6 pt-6">
        <div className="flex justify-end">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--wm-ink-3)] transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            閉じる
          </Link>
        </div>

        <div className="mt-10 text-center">
          <div
            className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[18px] text-white"
            style={{ background: "var(--wm-ink)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h14l-1.5 16a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4z" />
              <path d="M5 8h14" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">おかえりなさい</h1>
          <p className="mt-2 text-[13.5px] text-[var(--wm-ink-2)]">
            グループで会計を共有するにはログインが必要です
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {!csrfToken ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <form method="post" action="/api/auth/signin/google" onSubmit={() => setLoading("google")}>
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full bg-card"
                  disabled={loading !== null}
                >
                  {loading === "google" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  Googleで続ける
                </Button>
              </form>

              <form method="post" action="/api/auth/signin/line" onSubmit={() => setLoading("line")}>
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#06C755] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#05b34c] disabled:opacity-60"
                >
                  {loading === "line" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                  )}
                  LINEで続ける
                </button>
              </form>
            </>
          )}
        </div>

        {/* ソロモード誘導カード */}
        <div className="mt-8 rounded-[12px] bg-[var(--wm-surface)] p-4 text-[12px] leading-relaxed text-[var(--wm-ink-2)]">
          <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            登録不要で試したい方は
          </div>
          ソロモードならログインせずに使えます。データは端末に保存されます。
          <Link
            href="/solo"
            className="mt-2 block text-[13px] font-bold text-primary hover:underline"
          >
            ソロモードで試す →
          </Link>
        </div>
      </div>
    </div>
  )
}
