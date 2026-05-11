import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { HeroSection } from "@/components/landing/hero-section"
import { JoinSection } from "@/components/landing/join-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { FaqSection } from "@/components/landing/faq-section"
import { AccountMenu } from "@/components/layout/account-menu"

const HOME_FAQ_ITEMS = [
  {
    question: "warimeshi はどんな割り勘アプリですか？",
    answer:
      "warimeshi は飲み会・旅行・食事会・タクシー代の割り勘計算を無料で行えるウェブアプリです。注文ごとに金額を記録して、均等割りや傾斜配分で公平に精算できます。グループ共有用の招待リンクを発行できるので、幹事ひとりで全員の注文を打ち込む必要はありません。インストール不要・ログイン不要で、スマートフォンのブラウザからすぐに利用できます。",
  },
  {
    question: "飲み会の割り勘で端数 (1円単位) はどう処理されますか？",
    answer:
      "warimeshi は合計金額を人数で割った余り (端数) を自動的に検出します。たとえば 3,200 円を 3 人で割ると 1,066 円 × 2 名・1,068 円 × 1 名のように、端数 +1 円を負担する人を明示して表示します。誰がいくら払うか一目で分かるので、幹事が頭の中で計算する必要はありません。",
  },
  {
    question: "タクシー割り勘で途中下車する人がいる場合はどう計算しますか？",
    answer:
      "/taxi ページの「区間別」モードを使うと、出発地点 → 1人目降車地 → 2人目降車地 ... の順に距離と降りる人数を入力できます。距離料金はその区間に乗っている人数で按分されるため、先に降りる人は短い区間ぶん、最後まで乗る人は全区間ぶんを負担する公平な計算になります。初乗り料金・迎車料金・深夜割増・運転代行の長距離割増も設定で反映できます。",
  },
  {
    question: "グループ共有はどうやって使いますか？",
    answer:
      "「グループで始める」からテーブルを作成すると、招待用の URL と QR コードが発行されます。参加者がそのリンクを開くだけで自分のスマートフォンから注文を入力できるようになり、全員の画面にリアルタイムで反映されます。幹事は紙やメモを取らずに済み、お会計のときには各自の支払額が自動で表示されます。",
  },
  {
    question: "ログインや会員登録は必要ですか？無料ですか？",
    answer:
      "登録もログインも不要で、すべての機能を無料で利用できます。Google などでログインするとテーブルの履歴が残せますが、ゲストのまま使うこともできます。料金やサブスクリプションは一切なく、広告の表示も最小限です。",
  },
  {
    question: "ソロモードとグループモードの違いは何ですか？",
    answer:
      "ソロモードはひとりで自分の注文だけを素早く記録するモードで、ログイン不要・即時起動できます。グループモードは複数人で同じテーブルを共有し、招待リンク経由で各自が自分の注文を入力できるリアルタイム同期モードです。少人数の飲み会から大人数の宴会・旅行まで対応できます。",
  },
] as const

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
      <FaqSection items={[...HOME_FAQ_ITEMS]} />

      <footer className="mt-auto border-t border-[var(--wm-line)] bg-[var(--wm-surface)]/40 py-6">
        <div className="container mx-auto px-4 text-center text-[11px] text-[var(--wm-ink-3)]">
          <span style={{ fontFamily: "var(--font-inter)", fontWeight: 600 }}>warimeshi</span> · 飲み会の会計をスマートに
        </div>
      </footer>
    </main>
  )
}
