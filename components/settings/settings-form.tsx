"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { User } from "@/lib/types/group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

interface SettingsFormProps {
  user: User
}

export function SettingsForm({ user }: SettingsFormProps) {
  const [nickname, setNickname] = useState(user.nickname || "")
  const [isLoading, setIsLoading] = useState(false)
  const [swDisabled, setSwDisabled] = useState(false)
  const router = useRouter()

  // Load SW setting from localStorage
  useEffect(() => {
    setSwDisabled(localStorage.getItem("sw-disabled") === "1")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      })

      if (!res.ok) {
        throw new Error("Failed to save settings")
      }

      toast.success("設定を保存しました")
      router.refresh()
    } catch (error) {
      console.error("Error updating settings:", error)
      toast.error("保存に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/group"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            グループ一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">設定</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>プロフィール設定</CardTitle>
            <CardDescription>アカウント情報を編集できます</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input id="email" type="email" value={user.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">メールアドレスは変更できません</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">ニックネーム</Label>
                <Input
                  id="nickname"
                  placeholder="表示名"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">新しいテーブルに参加する際のデフォルト名になります</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="max-w-md mx-auto mt-4">
          <CardHeader>
            <CardTitle>オフライン設定</CardTitle>
            <CardDescription>PWA・Service Worker の設定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sw-toggle">オフラインモードを無効化</Label>
                <p className="text-xs text-muted-foreground">
                  共有端末でのセキュリティが気になる場合はオンにしてください
                </p>
              </div>
              <Switch
                id="sw-toggle"
                checked={swDisabled}
                onCheckedChange={(checked) => {
                  setSwDisabled(checked)
                  if (checked) {
                    localStorage.setItem("sw-disabled", "1")
                    // Unregister existing service workers
                    if ("serviceWorker" in navigator) {
                      navigator.serviceWorker.getRegistrations().then((regs) => {
                        regs.forEach((r) => r.unregister())
                      })
                    }
                    toast.success("オフラインモードを無効化しました")
                  } else {
                    localStorage.removeItem("sw-disabled")
                    // Register service worker
                    if ("serviceWorker" in navigator) {
                      navigator.serviceWorker.register("/sw.js").catch(() => {})
                    }
                    toast.success("オフラインモードを有効化しました")
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
