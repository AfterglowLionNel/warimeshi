import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SplitCalculator } from "@/components/calc/split-calculator"
import { FaqSection } from "@/components/landing/faq-section"

export const metadata: Metadata = {
  title: "割り勘計算機【無料】| 金額と人数で1人あたりを即計算",
  description: "合計金額と人数を入力するだけで1人あたりの金額を自動計算する無料の割り勘計算機。「金額に差をつける (多め/少なめ)」「お楽しみルーレット」にも対応。飲み会・旅行・タクシー代に。",
  alternates: {
    canonical: "https://warimeshi.com/calc",
  },
  openGraph: {
    title: "割り勘計算機【無料】| 金額と人数で1人あたりを即計算",
    description: "合計金額と人数を入力するだけで1人あたりの金額を自動計算。傾斜配分・ルーレット機能付きの無料割り勘ツール。",
  },
}

const CALC_FAQ_ITEMS = [
  {
    question: "この計算機ではどんな割り勘ができますか？",
    answer:
      "合計金額と人数を入力するだけで、1人あたりの金額と端数 (+1 円を負担する人数) を自動計算します。さらに「金額に差をつける」(多め/普通/少なめ) でよく飲む人の負担を増やしたり、お楽しみルーレットでランダムに割引・全額負担を抽選することもできます。",
    answerNode: (
      <p>
        <strong>合計金額と人数を入力するだけ</strong>で、1人あたりの金額と<strong>端数 (+1 円を負担する人数)</strong>を自動計算します。
        さらに <strong>「金額に差をつける」(多め/普通/少なめ)</strong> でよく飲む人の負担を増やしたり、
        <strong>お楽しみルーレット</strong>でランダムに割引・全額負担を抽選することもできます。
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
    question: "「金額に差をつける」とは？",
    answer:
      "「割り方」で「金額に差をつける」を選ぶと、各メンバーに「多め (×1.5)」「普通 (×1.0)」「少なめ (×0.5)」を設定できます。よく飲んだ人を多め、ソフトドリンクの人を少なめにすれば、不公平感のない割り勘ができます。",
    answerNode: (
      <p>
        「割り方」で <strong>「金額に差をつける」</strong> を選ぶと、各メンバーに
        <strong> 「多め (×1.5)」「普通 (×1.0)」「少なめ (×0.5)」</strong> を設定できます。
        よく飲んだ人を多め、ソフトドリンクの人を少なめにすれば、<strong>不公平感のない割り勘</strong>ができます。
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
          合計金額と人数を入れるだけ。端数処理・傾斜配分 (多め/少なめ)・ルーレット機能まで揃った最速の割り勘ツール。
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
