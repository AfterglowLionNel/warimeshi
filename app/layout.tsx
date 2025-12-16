import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"], preload: false })
const _geistMono = Geist_Mono({ subsets: ["latin"], preload: false })

export const metadata: Metadata = {
  title: "warimeshi - 割り勘計算",
  description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援するアプリ",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#d97706",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const enableAnalytics = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1"

  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
        {enableAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
