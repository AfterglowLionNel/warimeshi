import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, Users, Car } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-primary">warimeshi</h1>
          <p className="text-sm text-muted-foreground">割り勘・注文管理アプリ</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold mb-2">モードを選択してください</h2>
            <p className="text-muted-foreground">ソロモードは個人用、グループモードは複数人での管理に最適です</p>
          </div>

          <div className="grid gap-4">
            {/* Solo Mode Card */}
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>ソロモード</CardTitle>
                    <CardDescription>ログイン不要・個人用メモ</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  自分の注文だけを記録して、合計金額や割り勘を計算できます。 データはブラウザに保存されます。
                </p>
                <Button asChild className="w-full">
                  <Link href="/solo">ソロモードで始める</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Group Mode Card */}
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>グループモード</CardTitle>
                    <CardDescription>複数人で共有・管理</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  テーブルを作成して招待リンクを共有。 メンバー全員の注文をリアルタイムで管理できます。
                </p>
                <Button asChild className="w-full">
                  <Link href="/group">グループモードで始める</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Taxi Calculator Card */}
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Car className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>タクシー・代行計算</CardTitle>
                    <CardDescription>料金の割り勘計算</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  タクシーや運転代行の料金を距離に応じて計算。 複数人での乗り合い時の料金配分も可能です。
                </p>
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/taxi">計算ツールを開く</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>warimeshi - 飲み会の会計をスマートに</p>
        </div>
      </footer>
    </main>
  )
}
