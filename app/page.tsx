import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { HeroSection } from "@/components/landing/hero-section"
import { JoinSection } from "@/components/landing/join-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { AccountMenu } from "@/components/layout/account-menu"

export const metadata: Metadata = {
  title: "割り勘計算アプリ | 飲み会・旅行の精算を簡単に",
  description: "飲み会や旅行の割り勘計算を簡単にするアプリ。注文別の金額管理、グループ共有、タクシー料金の割り勘に対応。ログイン不要で今すぐ使える無料の割り勘計算ツール。",
  alternates: {
    canonical: "https://warimeshi.com",
  },
}

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--wm-line)] bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"
              style={{ background: "var(--wm-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h14l-1.5 16a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4z" />
                <path d="M5 8h14" />
              </svg>
            </span>
            <span style={{ fontFamily: "var(--font-inter)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
              warimeshi
            </span>
          </Link>
          <AccountMenu session={session} />
        </div>
      </header>

      <HeroSection />
      <JoinSection />
      <FeaturesSection />

      <footer className="mt-auto border-t border-[var(--wm-line)] bg-[var(--wm-surface)]/40 py-6">
        <div className="container mx-auto px-4 text-center text-[11px] text-[var(--wm-ink-3)]">
          <span style={{ fontFamily: "var(--font-inter)", fontWeight: 600 }}>warimeshi</span> · 飲み会の会計をスマートに
        </div>
      </footer>
    </main>
  )
}
