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
    question: "この計算機でできることは？",
    answer:
      "合計金額と人数を入力するだけで、1人あたりの金額と端数 (+1円負担の人数) を自動計算します。「割り方」を「金額に差をつける」に切り替えると多め・普通・少なめの傾斜配分が可能、「お楽しみ調整」では端数ルーレット・1人だけ500円引き・全額負担ルーレットの3種類が遊べます。ログイン不要・完全無料です。",
    answerNode: (
      <p>
        合計金額と人数を入力するだけで、<strong>1人あたりの金額と端数 (+1円負担の人数)</strong> を自動計算します。
        「割り方」を <strong>「金額に差をつける」</strong> に切り替えると多め・普通・少なめの傾斜配分が可能、
        <strong>「お楽しみ調整」</strong> では端数ルーレット・1人だけ500円引き・全額負担ルーレットの3種類が遊べます。
        ログイン不要・完全無料です。
      </p>
    ),
  },
  {
    question: "端数 (1円) はどう振り分けられますか？",
    answer:
      "合計を人数で割った余りを「ぴったり払う人」と「+1円を負担する人」に振り分けて、結果カードに人数別で表示します。例: 3,200円を3人で割ると、本来1人あたり1,066.67円なので 1,066円×2名 / 1,068円×1名 の組み合わせで合計ぴったり 3,200円。誰がいくら払えば過不足なくなるか一目で分かります。",
    answerNode: (
      <p>
        合計を人数で割った余りを<strong>「ぴったり払う人」と「+1円を負担する人」</strong>に振り分けて、結果カードに人数別で表示します。
        例: <strong>3,200円 ÷ 3人</strong> → 本来1人あたり1,066.67円なので
        <strong> 1,066円×2名 / 1,068円×1名</strong> の組み合わせで合計ぴったり 3,200円。
        誰がいくら払えば過不足なくなるか一目で分かります。
      </p>
    ),
  },
  {
    question: "「金額に差をつける」(多め・普通・少なめ) はどんな計算？",
    answer:
      "各メンバーに「多め (×1.5)」「普通 (×1.0)」「少なめ (×0.5)」のいずれかを設定すると、その比率で合計金額を配分します。例: 12,000円を4人 (多め1名・普通2名・少なめ1名) で割ると 多め4,800円 / 普通3,200円×2 / 少なめ1,600円。よく飲んだ人を多めに、ソフトドリンクの人を少なめにすれば不公平感のない割り勘ができます。",
    answerNode: (
      <p>
        各メンバーに <strong>「多め (×1.5)」「普通 (×1.0)」「少なめ (×0.5)」</strong> のいずれかを設定すると、
        その比率で合計金額を配分します。
        例: <strong>12,000円を4人 (多め1名・普通2名・少なめ1名)</strong> で割ると
        <strong> 多め4,800円 / 普通3,200円×2 / 少なめ1,600円</strong>。
        よく飲んだ人を多めに、ソフトドリンクの人を少なめにすれば<strong>不公平感のない割り勘</strong>ができます。
      </p>
    ),
  },
  {
    question: "お楽しみ調整 (ルーレット機能) はどんな種類がありますか？",
    answer:
      "3種類のルーレットを用意しています。(1) 端数だけルーレット: 100円未満の端数を当たった人1名にまとめて押し付け、他はキリのいい金額に。(2) 1人だけ500円引き: ランダムにラッキー1名が500円安く、差額を残りで均等補填。(3) 全額負担ルーレット: 当たった人が全額負担、他は0円の罰ゲーム風モード。スピン演出と紙吹雪エフェクト付きで、たまにオーバーシュート (止まった次の人にスライド) する小ネタもあります。",
    answerNode: (
      <>
        <p>3種類のルーレットを用意しています。</p>
        <ol className="space-y-1.5 pl-0 list-none">
          <li>
            <strong>① 端数だけルーレット</strong>
            <br />
            100円未満の端数を当たった人1名にまとめて押し付け、他はキリのいい金額に
          </li>
          <li>
            <strong>② 1人だけ500円引き</strong>
            <br />
            ランダムにラッキー1名が500円安く、差額を残りで均等補填
          </li>
          <li>
            <strong>③ 全額負担ルーレット</strong>
            <br />
            当たった人が全額負担、他は0円の罰ゲーム風モード
          </li>
        </ol>
        <p>
          スピン演出と<strong>紙吹雪エフェクト</strong>付きで、たまに<strong>オーバーシュート</strong> (止まった次の人にスライド) する小ネタもあります。
        </p>
      </>
    ),
  },
  {
    question: "参加者の名前は入力が必須ですか？",
    answer:
      "任意です。空欄なら「1人目」「2人目」と自動表示されます。お楽しみルーレットで誰が当たったか分かりやすくしたい時や、結果をLINE等に貼ってシェアしたい時に入力すると便利です。最大20文字まで、各人にカラーが自動割り当てされます。",
    answerNode: (
      <p>
        任意です。空欄なら <strong>「1人目」「2人目」</strong> と自動表示されます。
        <strong>お楽しみルーレット</strong>で誰が当たったか分かりやすくしたい時や、結果を<strong>LINE等に貼ってシェア</strong>したい時に入力すると便利です。
        最大20文字まで、各人にカラーが自動割り当てされます。
      </p>
    ),
  },
  {
    question: "もっと複雑な割り勘 (注文ごと・人ごとに違う金額) もできますか？",
    answer:
      "誰が何を頼んだか1品ずつ記録したい場合は「グループモード」、タクシー代の途中下車を区間別に按分したい場合は「タクシー割り勘」ページをご利用ください。グループモードは招待リンクで複数人がリアルタイム共有でき、こちらにも傾斜配分とお楽しみルーレットを搭載しています。",
    answerNode: (
      <p>
        誰が何を頼んだか1品ずつ記録したい場合は <strong>「グループモード」</strong>、
        タクシー代の途中下車を区間別に按分したい場合は <strong>「タクシー割り勘」</strong> ページをご利用ください。
        グループモードは<strong>招待リンクで複数人がリアルタイム共有</strong>でき、こちらにも傾斜配分とお楽しみルーレットを搭載しています。
      </p>
    ),
  },
  {
    question: "計算したデータは保存されますか？",
    answer:
      "/calc は完全にブラウザ内のみで計算しており、サーバーには何も送信・保存されません。ページを閉じたりリロードしたりすると入力内容は消えます。長期的に履歴を残したい場合は「ソロモード」(ログイン任意) や「グループモード」(招待リンク経由でテーブル共有) をご利用ください。",
    answerNode: (
      <p>
        /calc は<strong>完全にブラウザ内のみ</strong>で計算しており、サーバーには何も送信・保存されません。
        ページを閉じたりリロードしたりすると入力内容は消えます。
        長期的に履歴を残したい場合は <strong>「ソロモード」</strong>(ログイン任意) や
        <strong> 「グループモード」</strong>(招待リンク経由でテーブル共有) をご利用ください。
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
