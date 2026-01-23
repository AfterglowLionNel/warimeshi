"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="container mx-auto px-4 py-16 sm:py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
            飲み会の会計を、
            <br />
            <span className="text-primary">スマートに。</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            注文の記録から割り勘計算まで。
            <br className="hidden sm:block" />
            グループでの共有もワンリンクで完了。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/group">
                グループで始める
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/solo">
                ソロで試す
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          background: "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.15), transparent 50%)",
        }}
      />
    </section>
  )
}
