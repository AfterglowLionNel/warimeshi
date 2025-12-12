"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getAllSoloSessions, deleteSoloSession } from "@/lib/hooks/use-solo-session"
import { formatCurrency } from "@/lib/utils/format"
import type { SoloSession } from "@/lib/types/solo"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Plus, Trash2, ChevronRight, Loader2 } from "lucide-react"

export default function SoloHistoryPage() {
  const [sessions, setSessions] = useState<Array<{ id: string; session: SoloSession }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSessions(getAllSoloSessions())
    setIsLoading(false)
  }, [])

  const handleDelete = (sessionId: string) => {
    deleteSoloSession(sessionId)
    setSessions(getAllSoloSessions())
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/solo"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            ソロモードに戻る
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary">セッション履歴</h1>
              <p className="text-sm text-muted-foreground">{sessions.length}件のセッション</p>
            </div>
            <Button asChild size="sm">
              <Link href="/solo/new">
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">セッション履歴がありません</p>
              <Button asChild>
                <Link href="/solo/new">新規セッションを作成</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map(({ id, session }) => {
              const totalAmount = session.orders.reduce((sum, o) => sum + o.lineTotal, 0)
              const totalQuantity = session.orders.reduce((sum, o) => sum + o.quantity, 0)

              return (
                <Card key={id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/solo/${id}`} className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{session.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.createdAt).toLocaleDateString("ja-JP")} 作成
                            </p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-primary">{formatCurrency(totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">{totalQuantity}点</p>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>このセッションを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                「{session.name}」を削除します。この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                削除する
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Link href={`/solo/${id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
