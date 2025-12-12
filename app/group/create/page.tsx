"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { generateInviteToken } from "@/lib/utils/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function CreateTablePage() {
  const [tableName, setTableName] = useState("")
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0])
  const [displayName, setDisplayName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Prefill display name from saved profile / auth metadata
  useEffect(() => {
    const supabase = createClient()

    const loadDefaultName = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: dbUser } = await supabase.from("users").select("nickname").eq("firebase_uid", user.id).single()
      const fallback = user.user_metadata?.nickname || user.user_metadata?.name || user.email?.split("@")[0] || ""
      const suggested = dbUser?.nickname || fallback
      setDisplayName((prev) => prev || suggested || "")
    }

    void loadDefaultName()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tableName.trim() || !eventDate || !displayName.trim()) {
      toast.error("全ての項目を入力してください")
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login?redirect=/group/create")
        return
      }

      // Get user's DB record
      const { data: dbUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("firebase_uid", user.id)
        .single()

      if (userError || !dbUser) {
        throw new Error("ユーザー情報の取得に失敗しました")
      }

      // Generate invite token
      const inviteToken = generateInviteToken()

      // Create table
      const { data: newTable, error: tableError } = await supabase
        .from("tables")
        .insert({
          owner_user_id: dbUser.id,
          name: tableName.trim(),
          event_date: eventDate,
          invite_token: inviteToken,
        })
        .select()
        .single()

      if (tableError) throw tableError

      // Add creator as master member
      const { error: memberError } = await supabase.from("table_members").insert({
        table_id: newTable.id,
        user_id: dbUser.id,
        display_name: displayName.trim(),
        is_master: true,
      })

      if (memberError) throw memberError

      toast.success("テーブルを作成しました")
      router.push(`/group/table/${inviteToken}`)
    } catch (error) {
      console.error("Error creating table:", error)
      toast.error("テーブルの作成に失敗しました")
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
          <h1 className="text-xl font-bold text-primary">新規テーブル作成</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>テーブル情報</CardTitle>
            <CardDescription>飲み会やイベントの情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tableName">テーブル名 *</Label>
                <Input
                  id="tableName"
                  placeholder="例: 忘年会2024"
                  required
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventDate">開催日 *</Label>
                <Input
                  id="eventDate"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">あなたの表示名 *</Label>
                <Input
                  id="displayName"
                  placeholder="例: 田中"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">このテーブルでの表示名です（テーブルごとに変更可能）</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "テーブルを作成"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
