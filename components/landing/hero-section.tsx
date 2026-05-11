"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Car } from "lucide-react"
import { PreviewCard } from "@/components/landing/preview-card"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="container mx-auto px-5 py-10 sm:py-16 lg:py-24">
        <div className="max-w-md mx-auto md:max-w-xl space-y-6">
          {/* badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--wm-accent-soft)] px-3 py-1.5 text-[11px] font-bold tracking-wider text-[var(--wm-accent-pressed)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--wm-accent)]" />
            飲み会・タクシー割り勘の無料アプリ
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-foreground">
            飲み会の会計を、
            <br />
            <span className="text-primary">スマートに。</span>
          </h1>

          <p className="text-[15px] sm:text-base text-[var(--wm-ink-2)] leading-[1.7]">
            注文の記録から割り勘計算まで。
            <br className="hidden sm:block" />
            グループ共有もタクシー割り勘もワンタップで。
          </p>

          {/* CTA */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild size="lg" className="w-full sm:flex-1">
                <Link href="/group">
                  グループで始める
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto bg-transparent">
                <Link href="/solo">ソロで試す</Link>
              </Button>
            </div>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full bg-transparent border-[var(--wm-accent)]/30 text-[var(--wm-accent-pressed)] hover:bg-[var(--wm-accent-soft)] hover:text-[var(--wm-accent-pressed)]"
            >
              <Link href="/taxi">
                <Car className="mr-1 h-4 w-4" />
                タクシー割り勘で計算する
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* checks */}
          <div className="flex items-center gap-3 text-xs text-[var(--wm-ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              登録不要で使える
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-[var(--wm-ink-4)]" />
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              完全無料
            </span>
          </div>

          {/* preview */}
          <div className="pt-4">
            <PreviewCard />
          </div>

          {/* SEO 用詳細説明 */}
          <p className="pt-2 text-xs leading-relaxed text-[var(--wm-ink-3)]">
            warimeshiは飲み会・旅行・食事会の割り勘を簡単にする無料アプリです。
            誰が何を注文したか記録し、均等割りや傾斜配分で公平に精算。
            招待リンクを共有するだけでグループ全員がリアルタイムで注文を確認できます。
            タクシーや運転代行の料金計算にも対応。
          </p>
        </div>
      </div>
    </section>
  )
}
