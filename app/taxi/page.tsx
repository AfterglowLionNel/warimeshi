import type { Metadata } from "next"
import Link from "next/link"
import { TaxiCalculator } from "@/components/taxi/taxi-calculator"
import { FaqSection } from "@/components/landing/faq-section"
import { ArrowLeft } from "lucide-react"

const TAXI_FAQ_ITEMS = [
  {
    question: "タクシー割り勘の基本的な計算方法は？",
    answer:
      "メーター金額と乗車人数を入力するだけで均等割り (端数は +1 円で配分) が表示されます。距離だけ分かっているときは「距離」モードで初乗り料金・加算単価から運賃を推定でき、途中下車があるときは「区間別」モードで乗車中の人数に応じて公平に按分します。",
    answerNode: (
      <p>
        <strong>メーター金額と乗車人数を入力するだけ</strong>で均等割り (端数は +1 円で配分) が表示されます。
        距離だけ分かっているときは <strong>「距離」モード</strong> で初乗り料金・加算単価から運賃を推定でき、
        途中下車があるときは <strong>「区間別」モード</strong> で乗車中の人数に応じて公平に按分します。
      </p>
    ),
  },
  {
    question: "途中下車・途中乗降があるときはどう入力しますか？",
    answer:
      "「区間別」モードで、出発地点 → 1人目が降りる地点 → 次に降りる地点 ... の順に「前の地点からの距離」と「ここで降りる人数」を入力します。各区間の距離料金は、その区間に乗っている人数で割られます。先に降りる人は短い距離ぶん、最後まで乗る人は全区間ぶんを負担するので、目的地が近い人だけが損をするということがありません。",
    answerNode: (
      <p>
        <strong>「区間別」モード</strong> で、出発地点 → 1人目が降りる地点 → 次に降りる地点 ... の順に
        <strong>「前の地点からの距離」と「ここで降りる人数」</strong> を入力します。
        各区間の距離料金は、<strong>その区間に乗っている人数で割られます</strong>。
        先に降りる人は短い距離ぶん、最後まで乗る人は全区間ぶんを負担するので、目的地が近い人だけが損をするということがありません。
      </p>
    ),
  },
  {
    question: "初乗り料金・迎車料金・深夜割増は反映できますか？",
    answer:
      "「詳細設定」を開くと初乗り距離 (km)・初乗り料金・加算単価 (/km)・迎車料金を編集できます。深夜割増は距離モード上部のトグル (22:00〜05:00 想定 +20%) でワンタップ ON/OFF できます。割引・割増は「カスタム割増・割引」から円単位・% 単位で自由に追加できます。",
    answerNode: (
      <p>
        <strong>「詳細設定」</strong> を開くと <strong>初乗り距離 (km)・初乗り料金・加算単価 (/km)・迎車料金</strong> を編集できます。
        <strong>深夜割増</strong> は距離モード上部のトグル (22:00〜05:00 想定 +20%) でワンタップ ON/OFF できます。
        割引・割増は「カスタム割増・割引」から円単位・% 単位で自由に追加できます。
      </p>
    ),
  },
  {
    question: "運転代行と通常タクシーの違いは反映できますか？",
    answer:
      "詳細設定の車種タブで「タクシー」または「運転代行」を選択できます。代行は初乗り距離・初乗り料金・加算単価が一般的にタクシーより大きく、長距離割増 (例: 10km 超で +100 円/km) が設定されているケースが多いので、warimeshi では長距離閾値と追加単価をプロファイル別に保存できます。",
    answerNode: (
      <p>
        詳細設定の車種タブで <strong>「タクシー」または「運転代行」</strong> を選択できます。
        代行は初乗り距離・初乗り料金・加算単価が一般的にタクシーより大きく、
        <strong>長距離割増 (例: 10km 超で +100 円/km)</strong> が設定されているケースが多いので、
        warimeshi では <strong>長距離閾値と追加単価をプロファイル別に保存</strong> できます。
      </p>
    ),
  },
  {
    question: "迎車料金は誰が負担しますか？",
    answer:
      "迎車料金は乗車した全員で均等に負担する仕組みになっています。区間別モードでは、距離料金部分は各区間の乗車人数で按分し、迎車料金部分は乗車人数で均等割りされます。結果カードに「迎車料金 ¥xxx を n 人で均等分割 (1 人あたり ¥xxx)」と内訳が表示されます。",
    answerNode: (
      <p>
        <strong>迎車料金は乗車した全員で均等に負担</strong> する仕組みになっています。
        区間別モードでは、<strong>距離料金部分は各区間の乗車人数で按分</strong>し、
        <strong>迎車料金部分は乗車人数で均等割り</strong> されます。
        結果カードに「迎車料金 ¥xxx を n 人で均等分割 (1 人あたり ¥xxx)」と内訳が表示されます。
      </p>
    ),
  },
  {
    question: "計算結果の保存・共有はできますか？",
    answer:
      "グループモードでテーブルを作ってから /group/table/[token]/taxi にアクセスすると、入力内容と計算結果が自動で保存され、招待リンク経由で参加した全員の画面に同期されます。ソロのまま /taxi を開いた場合は端末内のローカル状態として動作するため、リロードや別端末からの確認はできません。",
    answerNode: (
      <p>
        <strong>グループモードでテーブルを作ってから</strong> <code>/group/table/[token]/taxi</code> にアクセスすると、
        入力内容と計算結果が自動で保存され、招待リンク経由で参加した<strong>全員の画面に同期</strong>されます。
        ソロのまま <code>/taxi</code> を開いた場合は端末内のローカル状態として動作するため、リロードや別端末からの確認はできません。
      </p>
    ),
  },
] as const

export const metadata: Metadata = {
  title: "タクシー割り勘計算 (途中下車対応) | 初乗り・迎車・深夜割増",
  description: "タクシーや運転代行の料金を人数で割り勘計算。途中下車・区間別の按分、初乗り料金、迎車料金、深夜割増にも対応。飲み会帰りのタクシー代を公平に精算できる無料ツール。",
  alternates: {
    canonical: "https://warimeshi.com/taxi",
  },
  openGraph: {
    title: "タクシー割り勘計算 (途中下車対応) | 初乗り・迎車・深夜割増",
    description: "タクシーや運転代行の料金を人数で割り勘計算。途中下車・区間別の按分・初乗り料金・迎車料金・深夜割増に対応。",
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

      <div className="mt-10">
        <FaqSection
          heading="タクシー割り勘 詳しい使い方・よくある質問"
          items={[...TAXI_FAQ_ITEMS]}
          jsonLdId="taxi-faq-heading"
        />
      </div>
    </main>
  )
}
