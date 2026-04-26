"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { User } from "@/lib/types/group"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Crown,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

interface TableData {
  id: string
  name: string
  event_date: string
  invite_token: string
  is_archived: boolean
  is_master: boolean
  member_count: number
}

interface GroupDashboardProps {
  user: User
  tables: TableData[]
}

export function GroupDashboard({ user, tables: initialTables }: GroupDashboardProps) {
  const [tables, setTables] = useState(initialTables)
  const _router = useRouter()

  const activeTables = tables.filter((t) => !t.is_archived)
  const archivedTables = tables.filter((t) => t.is_archived)

  const handleArchive = async (tableId: string, archive: boolean) => {
    const res = await fetch("/api/tables/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, archive }),
    })

    if (!res.ok) {
      toast.error(archive ? "アーカイブに失敗しました" : "アーカイブ解除に失敗しました")
      return
    }

    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, is_archived: archive } : t)))
    toast.success(archive ? "アーカイブしました" : "アーカイブを解除しました")
  }

  const handleDelete = async (tableId: string) => {
    const res = await fetch(`/api/tables/${tableId}`, { method: "DELETE" })

    if (!res.ok) {
      toast.error("削除に失敗しました")
      return
    }

    setTables((prev) => prev.filter((t) => t.id !== tableId))
    toast.success("テーブルを削除しました")
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--wm-ink-3)] transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          トップに戻る
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <div>
            <div className="text-[12px] text-[var(--wm-ink-3)]">グループモード</div>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight">テーブル一覧</h1>
          </div>
          <Button asChild size="sm" className="ml-auto">
            <Link href="/group/create">
              <Plus className="mr-0.5 h-4 w-4" />
              新規作成
            </Link>
          </Button>
        </div>

        {/* user panel */}
        <div className="wm-card mt-4 flex items-center gap-3 p-3">
          <span
            className="wm-avatar"
            style={{
              width: 40,
              height: 40,
              fontSize: 15,
              background: "var(--wm-ink)",
            }}
          >
            {user.nickname?.charAt(0) || user.email?.charAt(0) || "U"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{user.nickname || "ユーザー"}</p>
            <p className="truncate text-[11px] text-[var(--wm-ink-3)]">{user.email}</p>
          </div>
          <Button asChild variant="outline" size="icon" className="h-9 w-9 bg-card" aria-label="設定">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="h-9 w-9 bg-card" aria-label="ログアウト">
            <Link href="/auth/logout" prefetch={false}>
              <LogOut className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Tables */}
        <Tabs defaultValue="active" className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              参加中 ({activeTables.length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1">
              アーカイブ ({archivedTables.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {activeTables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">参加中のテーブルがありません</p>
                  <Button asChild>
                    <Link href="/group/create">テーブルを作成</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeTables.map((table) => (
                <TableCard key={table.id} table={table} onArchive={handleArchive} onDelete={handleDelete} />
              ))
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-4 space-y-3">
            {archivedTables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">アーカイブされたテーブルはありません</p>
                </CardContent>
              </Card>
            ) : (
              archivedTables.map((table) => (
                <TableCard key={table.id} table={table} onArchive={handleArchive} onDelete={handleDelete} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function TableCard({
  table,
  onArchive,
  onDelete,
}: {
  table: TableData
  onArchive: (id: string, archive: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Link href={`/group/table/${table.invite_token}`} className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{table.name}</h3>
                  {table.is_master && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      マスター
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(table.event_date).toLocaleDateString("ja-JP")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {table.member_count}人
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>

          {table.is_master && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table.is_archived ? (
                  <DropdownMenuItem onClick={() => onArchive(table.id, false)}>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    アーカイブ解除
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(table.id, true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    アーカイブ
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      削除
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>テーブルを削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        「{table.name}」と関連する全てのデータ（注文履歴、メンバー情報など）が完全に削除されます。
                        この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(table.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        削除する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
