"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Calendar, Users } from "lucide-react"

interface ArchivedTableNoticeProps {
  tableName: string
  eventDate?: string
  ownerName: string
  redirectPath?: string
  redirectAfterMs?: number
}

export function ArchivedTableNotice({
  tableName,
  eventDate,
  ownerName,
  redirectPath = "/group",
  redirectAfterMs = 10_000,
}: ArchivedTableNoticeProps) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(redirectAfterMs / 1000))

  useEffect(() => {
    const timer = setTimeout(() => router.push(redirectPath), redirectAfterMs)
    return () => clearTimeout(timer)
  }, [redirectAfterMs, redirectPath, router])

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <CardTitle className="text-xl font-bold text-primary">テーブルにアクセスできません</CardTitle>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 flex items-center justify-center">
        <Card className="max-w-xl w-full">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>このテーブルは作成者によりアーカイブされています</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              閲覧することはできません。何かあれば作成者にお問い合わせください。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-4 space-y-2">
              <div className="font-semibold">{tableName}</div>
              {eventDate ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(eventDate).toLocaleDateString("ja-JP")}
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                作成者: {ownerName}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{secondsLeft}秒後にグループ一覧へ戻ります。</span>
              <Button variant="outline" onClick={() => router.push(redirectPath)}>
                すぐ戻る
              </Button>
            </div>

            <div className="text-right">
              <Link href={redirectPath} className="text-sm text-primary underline">
                グループ一覧へ
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
