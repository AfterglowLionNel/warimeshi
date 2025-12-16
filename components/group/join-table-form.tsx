"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Table } from "@/lib/types/group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Users, Calendar, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface JoinTableFormProps {
  table: Table
  memberCount: number
  defaultDisplayName: string
}

export function JoinTableForm({ table, memberCount, defaultDisplayName }: JoinTableFormProps) {
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Save/restore draft from sessionStorage
  useEffect(() => {
    const draft = sessionStorage.getItem(`join-draft-${table.invite_token}`)
    if (draft) {
      setDisplayName(draft)
    }
  }, [table.invite_token])

  useEffect(() => {
    if (displayName !== defaultDisplayName) {
      sessionStorage.setItem(`join-draft-${table.invite_token}`, displayName)
    }
  }, [displayName, defaultDisplayName, table.invite_token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error("表示名を入力してください")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/table-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: table.id, displayName }),
      })

      if (!res.ok) {
        throw new Error("Failed to join table")
      }

      // Clear draft
      sessionStorage.removeItem(`join-draft-${table.invite_token}`)

      toast.success("テーブルに参加しました")
      router.push(`/group/table/${table.invite_token}`)
    } catch (error) {
      console.error("Error joining table:", error)
      toast.error("参加に失敗しました")
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
          <h1 className="text-xl font-bold text-primary">テーブルに参加</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{table.name}</CardTitle>
            <CardDescription className="space-y-1">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(table.event_date).toLocaleDateString("ja-JP")}
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                現在 {memberCount}人 参加中
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">あなたの表示名 *</Label>
                <Input
                  id="displayName"
                  placeholder="例: 田中"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">このテーブルでの表示名です</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    参加中...
                  </>
                ) : (
                  "参加する"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
