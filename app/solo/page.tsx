"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, History } from "lucide-react"

export default function SoloEntryPage() {
  const router = useRouter()

  const handleNewSession = () => {
    const sessionId = `solo-${Date.now()}`
    router.push(`/solo/${sessionId}`)
  }

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
          <h1 className="text-2xl font-bold text-primary">ソロモード</h1>
          <p className="text-sm text-muted-foreground">個人用の注文管理・割り勘計算</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-sm text-muted-foreground text-center bg-muted/50 p-3 rounded-lg">
            ※ データは端末に保存され、他のデバイスとは共有されません
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                新規セッション
              </CardTitle>
              <CardDescription>新しい注文記録を始めます</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleNewSession}>
                新規作成
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                履歴
              </CardTitle>
              <CardDescription>過去のセッションを確認</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/solo/history">履歴を見る</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
