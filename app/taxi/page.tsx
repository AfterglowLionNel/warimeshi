import Link from "next/link"
import { TaxiCalculator } from "@/components/taxi/taxi-calculator"
import { ArrowLeft } from "lucide-react"

export default function TaxiPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            トップに戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">タクシー・代行計算</h1>
          <p className="text-sm text-muted-foreground">料金の割り勘計算</p>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 max-w-lg">
        <TaxiCalculator />
      </div>
    </main>
  )
}
