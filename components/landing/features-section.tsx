"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { User, Users, Car, ChevronRight, ArrowRight } from "lucide-react"

const features = [
  {
    icon: User,
    title: "ソロモード",
    desc: "ログイン不要。自分の注文を素早く記録。",
    href: "/solo",
    accent: false,
  },
  {
    icon: Users,
    title: "グループモード",
    desc: "招待リンクで全員の注文をリアルタイム同期。",
    href: "/group",
    accent: true,
  },
  {
    icon: Car,
    title: "タクシー・代行計算",
    desc: "区間別の料金計算。途中下車も公平に。",
    href: "/taxi",
    accent: false,
    tag: "独自機能",
  },
] as const

export function FeaturesSection() {
  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-5">
        <div className="max-w-md mx-auto md:max-w-2xl">
          <div className="mb-3 text-[11px] font-bold tracking-[.12em] text-[var(--wm-ink-3)]">
            3つのモード
          </div>

          <div className="space-y-2.5">
            {features.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="wm-card flex items-start gap-3 p-4 transition hover:border-primary/40 hover:shadow-md"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                  style={{
                    background: f.accent ? "var(--wm-accent-soft)" : "var(--wm-surface)",
                    color: f.accent ? "var(--wm-accent)" : "var(--wm-ink)",
                  }}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold leading-tight">{f.title}</span>
                    {"tag" in f && f.tag && (
                      <span className="wm-chip wm-chip-accent" style={{ fontSize: 10, padding: "2px 7px" }}>
                        {f.tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-[var(--wm-ink-2)]">
                    {f.desc}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 self-center text-[var(--wm-ink-3)]" />
              </Link>
            ))}
          </div>
        </div>

        {/* 黒地 CTA */}
        <div className="max-w-md mx-auto md:max-w-2xl mt-10">
          <div
            className="rounded-2xl p-7"
            style={{ background: "var(--wm-ink)", color: "#fff" }}
          >
            <div className="text-[11px] font-bold tracking-[.1em] opacity-50">READY?</div>
            <h3 className="mt-1.5 mb-4 text-2xl font-bold leading-snug">
              次の飲み会から
              <br />
              使ってみませんか
            </h3>
            <Button asChild size="lg" className="w-full">
              <Link href="/group">
                無料で始める
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* SEO 詳細 */}
        <div className="max-w-2xl mx-auto mt-12 text-[var(--wm-ink-2)]">
          <h2 className="mb-4 text-center text-lg font-semibold text-foreground">
            warimeshiが選ばれる理由
          </h2>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              <strong>飲み会の割り勘計算</strong>で困ったことはありませんか？
              「誰が何を頼んだか分からなくなった」「端数の処理が面倒」「後から精算を確認したい」
              warimeshi はこれらをすべて解決します。
            </p>
            <p>
              <strong>グループ共有機能</strong>では、招待リンクを共有するだけで全員が参加可能。
              各自がスマートフォンから注文を入力でき、リアルタイムで全員の画面に反映されます。
              幹事が一人で全員の注文を管理する必要はありません。
            </p>
            <p>
              <strong>タクシー割り勘計算</strong>は、warimeshi ならではの機能です。
              「途中で降りる人がいる」「初乗りをどう分けるか」といった複雑な計算も区間入力だけで公平に算出。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
