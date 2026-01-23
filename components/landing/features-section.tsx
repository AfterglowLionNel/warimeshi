"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { User, Users, Car, ArrowRight } from "lucide-react"

const features = [
  {
    icon: User,
    title: "ソロモード",
    description: "ログイン不要で、自分の注文だけを素早く記録。データはブラウザに自動保存されるので、いつでも履歴を確認できます。",
    note: "※ データは端末に保存され、他のデバイスとは共有されません",
    href: "/solo",
    cta: "ソロモードで始める",
    variant: "outline" as const,
  },
  {
    icon: Users,
    title: "グループモード",
    description: "招待リンクを共有するだけで、メンバー全員の注文をリアルタイム同期。誰が何を頼んだか一目でわかります。",
    note: undefined as string | undefined,
    href: "/group",
    cta: "グループで始める",
    variant: "default" as const,
  },
  {
    icon: Car,
    title: "タクシー・代行計算",
    description: "区間別の料金計算で、途中下車する人がいても公平に割り勘。降りる順番と距離を入力するだけで、各自の支払い額を自動算出します。",
    note: "他にはない独自の区間別計算システム",
    href: "/taxi",
    cta: "計算ツールを開く",
    variant: "default" as const,
    highlight: true,
  },
]

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            3つのモードで、あらゆる場面に対応
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            シーンに合わせて最適なモードを選べます
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group relative flex flex-col p-6 sm:p-8 rounded-2xl border bg-card transition-all hover:border-primary/50 hover:shadow-lg ${
                "highlight" in feature && feature.highlight ? "border-primary/30 ring-1 ring-primary/20" : ""
              }`}
            >
              {"highlight" in feature && feature.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                    独自機能
                  </span>
                </div>
              )}
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>

              <div className="flex-grow mb-6">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
                {"note" in feature && feature.note && (
                  <p className={`text-xs mt-2 ${
                    "highlight" in feature && feature.highlight
                      ? "text-primary font-medium"
                      : "text-muted-foreground/70"
                  }`}>
                    {feature.note}
                  </p>
                )}
              </div>

              <Button asChild variant={feature.variant} className="w-full group-hover:translate-x-0">
                <Link href={feature.href}>
                  {feature.cta}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
