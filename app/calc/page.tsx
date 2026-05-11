import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SplitCalculator } from "@/components/calc/split-calculator"
import { FaqSection } from "@/components/landing/faq-section"

export const metadata: Metadata = {
  title: "割り勘計算機【無料】| 金額と人数で1人あたりを即計算",
  description: "合計金額と人数を入力するだけで1人あたりの金額を自動計算する無料の割り勘計算機。端数の処理、100円・500円・1000円単位への切り上げにも対応。飲み会・旅行・タクシー代に。",
  alternates: {
    canonical: "https://warimeshi.com/calc",
  },
  openGraph: {
    title: "割り勘計算機【無料】| 金額と人数で1人あたりを即計算",
    description: "合計金額と人数を入力するだけで1人あたりの金額を自動計算。端数や切り上げにも対応した無料の割り勘ツール。",
  },
}

const CALC_FAQ_ITEMS = [
  {
    question: "この計算機ではどんな割り勘ができますか？",
    answer:
      "合計金額と人数を入力するだけで、1人あたりの金額と端数 (+1 円を負担する人数) を自動計算します。100円・500円・1000円単位での切り上げにも対応しているため、現金で集金しやすい金額に揃えることもできます。",
    answerNode: (
      <p>
        <strong>合計金額と人数を入力するだけ</strong>で、1人あたりの金額と<strong>端数 (+1 円を負担する人数)</strong>を自動計算します。
        <strong>100円・500円・1000円単位での切り上げ</strong>にも対応しているため、現金で集金しやすい金額に揃えることもできます。
      </p>
    ),
  },
  {
    question: "端数 (1円単位) はどう処理されますか？",
    answer:
      "1円単位を選んだ場合、合計を人数で割った余りを「+1円を負担する人」と「ぴったりの人」に振り分けて表示します。例: 3,200円を3人で割ると 1,066円×2名 / 1,068円×1名、のような分け方になります。",
    answerNode: (
      <p>
        1円単位を選んだ場合、合計を人数で割った余りを<strong>「+1円を負担する人」と「ぴったりの人」</strong>に振り分けて表示します。
        例: <strong>3,200円 ÷ 3人 → 1,066円×2名 / 1,068円×1名</strong> のような分け方になります。
      </p>
    ),
  },
  {
    question: "100円単位で集金したいときは？",
    answer:
      "「100円」を選ぶと、1人あたりの金額が100円単位で切り上げられます。例: 3,200円を3人で割ると本来1人あたり1,066.67円ですが、100円単位なら1人あたり1,100円。集金合計は3,300円となり、幹事の手元に100円のおつりが残ります。500円・1000円単位も同様です。",
    answerNode: (
      <p>
        「100円」を選ぶと、1人あたりの金額が <strong>100円単位で切り上げ</strong> られます。
        例: 3,200円を3人で割ると本来1人あたり1,066.67円ですが、100円単位なら <strong>1人あたり1,100円</strong>。
        集金合計は3,300円となり、<strong>幹事の手元に100円のおつり</strong>が残ります。500円・1000円単位も同様です。
      </p>
    ),
  },
  {
    question: "もっと細かい割り勘 (注文ごと・人ごとに金額が違う) もできますか？",
    answer:
      "より複雑な割り勘 (誰が何を頼んだか管理、傾斜配分、ルーレットなど) は「グループモード」をご利用ください。複数人で同じテーブルを共有でき、各自がスマートフォンから自分の注文を入力できます。タクシーや運転代行の途中下車対応は「タクシー割り勘」ページから。",
    answerNode: (
      <p>
        より複雑な割り勘 (<strong>誰が何を頼んだか管理・傾斜配分・ルーレット</strong>など) は <strong>「グループモード」</strong> をご利用ください。
        複数人で同じテーブルを共有でき、各自がスマートフォンから自分の注文を入力できます。
        タクシーや運転代行の<strong>途中下車対応</strong>は <strong>「タクシー割り勘」</strong> ページから。
      </p>
    ),
  },
] as const

export default function CalcPage() {
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
            <div className="text-[12px] text-[var(--wm-ink-3)]">かんたん計算 · ログイン不要</div>
            <h1 className="mt-0.5 text-[18px] font-semibold leading-tight">割り勘計算機</h1>
          </div>
        </div>

        <p className="mt-4 rounded-[12px] bg-[var(--wm-surface)] p-3 text-[12px] leading-relaxed text-[var(--wm-ink-2)]">
          合計金額と人数を入れるだけ。1人あたりの金額・端数・切り上げに対応した最速の割り勘ツールです。
        </p>

        <div className="mt-4">
          <SplitCalculator />
        </div>
      </div>

      <div className="mt-10">
        <FaqSection
          heading="割り勘計算機 よくある質問"
          items={[...CALC_FAQ_ITEMS]}
          jsonLdId="calc-faq-heading"
        />
      </div>
    </main>
  )
}
