import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "ソロ割り勘計算 | ログイン不要・端末保存",
  description: "ログイン不要で使える個人向け割り勘計算。飲み会や食事会の注文を記録し、人数で割り勘計算。データは端末に保存され、プライバシーも安心。",
  alternates: {
    canonical: "https://warimeshi.com/solo",
  },
  openGraph: {
    title: "ソロ割り勘計算 | ログイン不要・端末保存",
    description: "ログイン不要で使える個人向け割り勘計算。飲み会や食事会の注文を記録し、人数で割り勘計算。",
  },
}

export default function SoloLayout({ children }: { children: ReactNode }) {
  return children
}
