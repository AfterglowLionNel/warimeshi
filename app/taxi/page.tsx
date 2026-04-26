import type { Metadata } from "next"
import Link from "next/link"
import { TaxiCalculator } from "@/components/taxi/taxi-calculator"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "タクシー割り勘計算 | 初乗り・迎車・深夜割増対応",
  description: "タクシーや運転代行の料金を人数で割り勘計算。初乗り料金、迎車料金、深夜割増、区間別の途中乗降にも対応。飲み会帰りのタクシー代を公平に精算。",
  alternates: {
    canonical: "https://warimeshi.com/taxi",
  },
  openGraph: {
    title: "タクシー割り勘計算 | 初乗り・迎車・深夜割増対応",
    description: "タクシーや運転代行の料金を人数で割り勘計算。初乗り料金、迎車料金、深夜割増に対応。",
  },
}

export default function TaxiPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 pt-5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="戻る"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-[var(--wm-surface)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="text-[12px] text-[var(--wm-ink-3)]">区間別計算 · 途中下車 OK</div>
            <h1 className="mt-0.5 text-[18px] font-semibold leading-tight">タクシー割り勘</h1>
          </div>
        </div>

        <p className="mt-4 rounded-[12px] bg-[var(--wm-surface)] p-3 text-[12px] leading-relaxed text-[var(--wm-ink-2)]">
          飲み会帰りのタクシー・運転代行を公平に割り勘。途中下車も乗車距離で自動按分します。
        </p>

        <div className="mt-4">
          <TaxiCalculator />
        </div>
      </div>
    </main>
  )
}
