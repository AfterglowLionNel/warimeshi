"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, History } from "lucide-react"

export default function SoloEntryPage() {
  const router = useRouter()

  const handleNewSession = () => {
    const sessionId = `solo-${Date.now()}`
    router.push(`/solo/${sessionId}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--wm-ink-3)] transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          トップに戻る
        </Link>

        <div className="mt-4">
          <div className="text-[12px] text-[var(--wm-ink-3)]">ソロモード · 自動保存</div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight">個人用の注文管理</h1>
        </div>

        {/* 黒地の合計カード (空状態) */}
        <div className="mt-5 rounded-2xl p-5" style={{ background: "var(--wm-ink)", color: "#fff" }}>
          <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">合計</div>
          <div className="wm-num mt-1 text-[32px] font-bold leading-none">¥0</div>
          <div className="mt-2 text-[12px] opacity-60">新しい記録を始めましょう</div>
        </div>

        {/* メイン CTA */}
        <Button onClick={handleNewSession} className="mt-5 h-12 w-full text-[15px]">
          <Plus className="mr-1 h-4 w-4" />
          新規セッションを作成
        </Button>

        {/* 履歴へ */}
        <Link
          href="/solo/history"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--wm-line)] bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
        >
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-foreground"
            style={{ background: "var(--wm-surface)" }}
          >
            <History className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">履歴を見る</div>
            <div className="mt-0.5 text-[12px] text-[var(--wm-ink-3)]">過去のセッションを確認</div>
          </div>
          <span className="text-[var(--wm-ink-3)]">›</span>
        </Link>

        <p className="mt-6 rounded-[12px] bg-[var(--wm-surface)] p-3 text-center text-[12px] leading-relaxed text-[var(--wm-ink-2)]">
          ※ データは端末に保存され、他のデバイスとは共有されません
        </p>
      </div>
    </main>
  )
}
