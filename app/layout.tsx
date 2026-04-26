import type React from "react"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Zen_Kaku_Gothic_New, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { BottomTabBar } from "@/components/layout/bottom-tab-bar"
import "./globals.css"

const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "warimeshi - 割り勘計算アプリ",
    template: "%s | warimeshi",
  },
  description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援する無料アプリ。グループで注文を共有し、公平に割り勘できます。",
  keywords: ["割り勘", "割り勘アプリ", "飲み会", "幹事", "注文管理", "タクシー料金", "代行料金", "計算", "無料"],
  authors: [{ name: "warimeshi" }],
  creator: "warimeshi",
  metadataBase: new URL("https://warimeshi.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://warimeshi.com",
    siteName: "warimeshi",
    title: "warimeshi - 割り勘計算アプリ",
    description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援する無料アプリ",
  },
  twitter: {
    card: "summary_large_image",
    title: "warimeshi - 割り勘計算アプリ",
    description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援する無料アプリ",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
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
  themeColor: "#C8553D",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const enableAnalytics = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1"
  // ホワイトリスト判定: "development" のときのみ SW を全削除する。本番は SW を有効化。
  const isDev = process.env.NODE_ENV === "development"

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://warimeshi.com/#website",
        url: "https://warimeshi.com",
        name: "warimeshi",
        description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援する無料アプリ",
        inLanguage: "ja",
      },
      {
        "@type": "WebApplication",
        "@id": "https://warimeshi.com/#app",
        name: "warimeshi",
        url: "https://warimeshi.com",
        applicationCategory: "UtilityApplication",
        operatingSystem: "All",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "JPY",
        },
        description: "飲み会の割り勘・注文管理とタクシー/代行料金計算を支援する無料アプリ",
      },
    ],
  }

  return (
    <html lang="ja" className={`${zenKakuGothicNew.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="pb-[68px] md:pb-0">{children}</div>
        <BottomTabBar />
        <Toaster position="top-center" richColors />
        {enableAnalytics ? <Analytics /> : null}
        {isDev ? (
          // dev モード: 既存の Service Worker と Cache を消す。
          // next/script の beforeInteractive は CSP nonce のハイドレーション不整合を起こすので、
          // プレーンな <script> を使う。
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `(function(){
                if(!('serviceWorker' in navigator)) return;
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  var hadAny = regs.length > 0;
                  Promise.all(regs.map(function(r){return r.unregister()})).then(function(){
                    if('caches' in window){
                      caches.keys().then(function(keys){
                        Promise.all(keys.map(function(k){return caches.delete(k)})).then(function(){
                          if(hadAny || keys.length){
                            if(!sessionStorage.getItem('__sw_cleared__')){
                              sessionStorage.setItem('__sw_cleared__','1');
                              location.reload();
                            }
                          }
                        });
                      });
                    }
                  });
                });
              })();`,
            }}
          />
        ) : (
          <Script id="sw-register" strategy="afterInteractive">
            {`if('serviceWorker' in navigator){
              if(localStorage.getItem('sw-disabled')==='1'){
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){r.unregister()})
                })
              }else{
                navigator.serviceWorker.register('/sw.js').catch(function(){})
              }
            }`}
          </Script>
        )}
      </body>
    </html>
  )
}
