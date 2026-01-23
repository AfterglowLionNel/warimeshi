"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Order, Table, TableMember, User } from "@/lib/types/group"
import { formatCurrency } from "@/lib/utils/format"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  Car,
  Calculator,
  Check,
  Copy,
  Crown,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { InviteQRCode } from "./invite-qr-code"
import { InviteShareButton } from "./invite-share-button"
import { getGuestToken } from "@/lib/guest/guest-session"

interface TableDetailClientProps {
  table: Table
  currentUser: User
  currentMembership: TableMember
  initialMembers: (TableMember & { user?: User })[]
  initialOrders: (Order & { member?: TableMember })[]
  isGuestUser?: boolean
}

type SortField = "display_name" | "unit_price" | "quantity" | "created_at"
type SortDirection = "asc" | "desc"

const ITEMS_PER_PAGE = 10
const POLL_INTERVAL = 5000
const MEMBER_COLORS = ["#e0f2fe", "#fef9c3", "#f5f3ff", "#ecfccb", "#f1f5f9", "#ffe4e6", "#f0f9ff", "#fef2f2"]

// Helper to map API response (camelCase) to component format (snake_case)
function mapMemberFromApi(m: any): TableMember & { user?: User } {
  return {
    id: m.id,
    table_id: m.tableId ?? m.table_id,
    user_id: m.userId ?? m.user_id,
    display_name: m.displayName ?? m.display_name,
    is_master: m.isMaster ?? m.is_master,
    is_guest: m.isGuest ?? m.is_guest,
    added_by_user_id: m.addedByUserId ?? m.added_by_user_id,
    joined_at: m.joinedAt ?? m.joined_at,
    user: m.user ? {
      id: m.user.id,
      firebase_uid: m.user.id,
      email: m.user.email,
      nickname: m.user.nickname,
      is_admin: m.user.isAdmin ?? m.user.is_admin,
      created_at: m.user.createdAt ?? m.user.created_at,
      updated_at: m.user.updatedAt ?? m.user.updated_at,
    } : undefined,
  }
}

function mapOrderFromApi(o: any): Order & { member?: TableMember } {
  return {
    id: o.id,
    table_id: o.tableId ?? o.table_id,
    member_id: o.memberId ?? o.member_id,
    created_by_user_id: o.createdByUserId ?? o.created_by_user_id,
    item_name: o.itemName ?? o.item_name,
    unit_price: o.unitPrice ?? o.unit_price,
    quantity: o.quantity,
    line_total: o.lineTotal ?? o.line_total,
    deleted_at: o.deletedAt ?? o.deleted_at,
    created_at: o.createdAt ?? o.created_at,
    updated_at: o.updatedAt ?? o.updated_at,
    member: o.member ? mapMemberFromApi(o.member) : undefined,
  }
}

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const guestToken = getGuestToken()
  if (guestToken) {
    headers["X-Guest-Token"] = guestToken
  }
  return headers
}

export function TableDetailClient({
  table,
  currentUser,
  currentMembership,
  initialMembers,
  initialOrders,
  isGuestUser = false,
}: TableDetailClientProps) {
  const isTableOwner = table.owner_user_id === currentUser.id

  const [members, setMembers] = useState(initialMembers)
  const [orders, setOrders] = useState(initialOrders)
  const [isCopied, setIsCopied] = useState(false)

  const [selectedMember, setSelectedMember] = useState<string>(currentMembership.id)
  const [itemName, setItemName] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [filterMember, setFilterMember] = useState<string>("__all__")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("display_name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    member_id: string
    item_name: string
    unit_price: string
    quantity: string
  } | null>(null)

  // Simple split state
  const [splitPeopleCount, setSplitPeopleCount] = useState<string>("")

  // Guest member state
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [isAddingGuest, setIsAddingGuest] = useState(false)

  // Lock state
  const [isLocked, setIsLocked] = useState(table.is_locked)
  const [autoLockAt, setAutoLockAt] = useState<string | null>(table.auto_lock_at)
  const [isTogglingLock, setIsTogglingLock] = useState(false)

  // Calculate effective lock status
  const isEffectivelyLocked = isLocked || (autoLockAt && new Date(autoLockAt) < new Date())

  const memberColorMap = useMemo(() => {
    const sortedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
    return sortedMembers.reduce<Record<string, string>>((acc, member, idx) => {
      acc[member.id] = MEMBER_COLORS[idx % MEMBER_COLORS.length]
      return acc
    }, {})
  }, [members])

  useEffect(() => {
    const fetchUpdates = async () => {
      const headers = getApiHeaders()
      try {
        const [membersRes, ordersRes] = await Promise.all([
          fetch(`/api/table-members?tableId=${table.id}`, { headers }),
          fetch(`/api/orders?tableId=${table.id}`, { headers }),
        ])

        if (membersRes.ok) {
          const json = (await membersRes.json()) as { data?: any[] }
          if (json.data) setMembers(json.data.map(mapMemberFromApi))
        }
        if (ordersRes.ok) {
          const json = (await ordersRes.json()) as { data?: any[] }
          if (json.data) setOrders(json.data.map(mapOrderFromApi))
        }
      } catch (err) {
        console.error("Failed to poll updates", err)
      }
    }

    void fetchUpdates()
    const interval = setInterval(fetchUpdates, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [table.id])

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/group/join/${table.invite_token}`

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(link)
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement("textarea")
        textarea.value = link
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        const successful = document.execCommand("copy")
        document.body.removeChild(textarea)
        if (!successful) {
          throw new Error("execCommand copy failed")
        }
      }
      setIsCopied(true)
      toast.success("招待リンクをコピーしました")
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy invite link", error)
      toast.error("コピーに失敗しました。手動でコピーしてください。")
    }
  }

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = Number.parseInt(unitPrice, 10)
    const qty = Number.parseInt(quantity, 10) || 1

    if (isNaN(price) || price < 0) {
      toast.error("金額を正しく入力してください")
      return
    }

    setIsSubmitting(true)

    try {
      const inserts =
        selectedMember === "__all__"
          ? members.map((m) => ({
              table_id: table.id,
              member_id: m.id,
              item_name: itemName.trim() || null,
              unit_price: price,
              quantity: qty,
              line_total: price * qty,
            }))
          : [
              {
                table_id: table.id,
                member_id: selectedMember,
                item_name: itemName.trim() || null,
                unit_price: price,
                quantity: qty,
                line_total: price * qty,
              },
            ]

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({ orders: inserts }),
      })

      if (!res.ok) {
        throw new Error("Failed to add order")
      }

      setItemName("")
      setUnitPrice("")
      setQuantity("1")
      toast.success("注文を追加しました")

      const refreshed = await fetch(`/api/orders?tableId=${table.id}`, { headers: getApiHeaders() })
      if (refreshed.ok) {
        const json = (await refreshed.json()) as { data?: any[] }
        if (json.data) setOrders(json.data.map(mapOrderFromApi))
      }
    } catch (error) {
      console.error("Error adding order:", error)
      toast.error("注文の追加に失敗しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (order: Order & { member?: TableMember }) => {
    setEditingOrderId(order.id)
    setEditForm({
      member_id: order.member_id,
      item_name: order.item_name || "",
      unit_price: order.unit_price.toString(),
      quantity: order.quantity.toString(),
    })
  }

  const cancelEdit = () => {
    setEditingOrderId(null)
    setEditForm(null)
  }

  const saveEdit = async (orderId: string) => {
    if (!editForm) return

    const price = Number.parseInt(editForm.unit_price, 10)
    const qty = Number.parseInt(editForm.quantity, 10) || 1

    if (isNaN(price) || price < 0) {
      toast.error("金額を正しく入力してください")
      return
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          updates: {
            member_id: editForm.member_id,
            item_name: editForm.item_name.trim() || null,
            unit_price: price,
            quantity: qty,
            line_total: price * qty,
          },
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || "Failed to update order")
      }

      toast.success("注文を更新しました")
      cancelEdit()

      const refreshed = await fetch(`/api/orders?tableId=${table.id}`, { headers: getApiHeaders() })
      if (refreshed.ok) {
        const json = (await refreshed.json()) as { data?: any[] }
        if (json.data) setOrders(json.data.map(mapOrderFromApi))
      }
    } catch (error) {
      console.error("Error updating order:", error)
      const message = error instanceof Error ? error.message : "更新に失敗しました"
      toast.error(message)
    }
  }

  const deleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE", headers: getApiHeaders() })

      if (!res.ok) {
        throw new Error("Failed to delete order")
      }

      setOrders((prev) => prev.filter((o) => o.id !== orderId))
      toast.success("注文を削除しました")
    } catch (error) {
      console.error("Error deleting order:", error)
      toast.error("削除に失敗しました")
    }
  }

  const processedOrders = useMemo(() => {
    let result = [...orders]

    if (filterMember !== "__all__") {
      result = result.filter((o) => o.member_id === filterMember)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (o) => o.item_name?.toLowerCase().includes(query) || o.member?.display_name.toLowerCase().includes(query),
      )
    }

    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "display_name":
          comparison = (a.member?.display_name || "").localeCompare(b.member?.display_name || "", "ja")
          break
        case "unit_price":
          comparison = a.unit_price - b.unit_price
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "created_at":
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [orders, filterMember, searchQuery, sortField, sortDirection])

  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE)
  const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const canManageOrder = (order: Order & { member?: TableMember }) =>
    isTableOwner || order.created_by_user_id === currentUser.id || (order.member && order.member.user_id === currentUser.id)

  const canDeleteMember = (member: TableMember & { user?: User }) => {
    if (member.is_master) return false
    if (isTableOwner) return true
    if (member.is_guest && member.added_by_user_id === currentUser.id) return true
    if (!member.is_guest && member.user_id === currentUser.id) return true
    return false
  }

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestName.trim()) {
      toast.error("名前を入力してください")
      return
    }

    setIsAddingGuest(true)
    try {
      const res = await fetch("/api/table-members", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          tableId: table.id,
          displayName: guestName.trim(),
          isGuest: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to add guest")
      }

      setGuestName("")
      setShowGuestForm(false)
      toast.success("ゲストメンバーを追加しました")

      // Refresh members
      const refreshed = await fetch(`/api/table-members?tableId=${table.id}`, { headers: getApiHeaders() })
      if (refreshed.ok) {
        const json = (await refreshed.json()) as { data?: any[] }
        if (json.data) setMembers(json.data.map(mapMemberFromApi))
      }
    } catch (error) {
      console.error("Error adding guest:", error)
      const message = error instanceof Error ? error.message : "ゲストの追加に失敗しました"
      toast.error(message)
    } finally {
      setIsAddingGuest(false)
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/table-members?memberId=${memberId}`, { method: "DELETE", headers: getApiHeaders() })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete member")
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      toast.success("メンバーを削除しました")
    } catch (error) {
      console.error("Error deleting member:", error)
      const message = error instanceof Error ? error.message : "削除に失敗しました"
      toast.error(message)
    }
  }

  const handleToggleLock = async () => {
    if (!isTableOwner) return

    setIsTogglingLock(true)
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({ isLocked: !isEffectivelyLocked }),
      })

      if (!res.ok) {
        throw new Error("Failed to toggle lock")
      }

      const data = await res.json()
      setIsLocked(data.isLocked)
      setAutoLockAt(data.autoLockAt)

      if (data.isLocked) {
        toast.success("新規参加を締め切りました")
      } else {
        toast.success("参加を再開しました")
      }
    } catch (error) {
      console.error("Error toggling lock:", error)
      toast.error("操作に失敗しました")
    } finally {
      setIsTogglingLock(false)
    }
  }

  const totals = useMemo(() => {
    const totalQuantity = orders.reduce((sum, o) => sum + o.quantity, 0)
    const totalAmount = orders.reduce((sum, o) => sum + o.line_total, 0)

    const byMember = members.map((member) => {
      const memberOrders = orders.filter((o) => o.member_id === member.id)
      return {
        member,
        quantity: memberOrders.reduce((sum, o) => sum + o.quantity, 0),
        amount: memberOrders.reduce((sum, o) => sum + o.line_total, 0),
        count: memberOrders.length,
      }
    })

    return { totalQuantity, totalAmount, byMember }
  }, [orders, members])

  return (
    <main className="min-h-screen flex flex-col pb-4">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/group"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            グループ一覧に戻る
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary">{table.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(table.event_date).toLocaleDateString("ja-JP")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {members.length}人
                </span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/group/table/${table.invite_token}/taxi`}>
                <Car className="h-4 w-4 mr-1" />
                代行計算
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">招待リンク</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/group/join/${table.invite_token}`}
                  readOnly
                  className="text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink} title="コピー">
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <InviteQRCode
                  inviteUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/group/join/${table.invite_token}`}
                  tableName={table.name}
                />
                <InviteShareButton
                  inviteUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/group/join/${table.invite_token}`}
                  tableName={table.name}
                />
              </div>
            </div>

            {isTableOwner && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {isEffectivelyLocked ? (
                    <Lock className="h-4 w-4 text-amber-600" />
                  ) : (
                    <LockOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {isEffectivelyLocked ? (
                      <span className="text-amber-600">新規参加を締め切り中</span>
                    ) : (
                      <span className="text-muted-foreground">参加を受付中</span>
                    )}
                  </span>
                </div>
                <Button
                  variant={isEffectivelyLocked ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleLock}
                  disabled={isTogglingLock}
                >
                  {isEffectivelyLocked ? "参加を再開" : "参加を締め切る"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                メンバー ({members.length}人)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGuestForm(!showGuestForm)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                ゲスト追加
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showGuestForm && (
              <form onSubmit={handleAddGuest} className="flex gap-2 p-3 bg-muted rounded-lg">
                <Input
                  placeholder="ゲストの名前"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={isAddingGuest}>
                  追加
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowGuestForm(false)
                    setGuestName("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            )}
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <Badge
                  key={member.id}
                  variant={member.id === currentMembership.id ? "default" : "secondary"}
                  className="flex items-center gap-1 text-black group"
                  style={{
                    backgroundColor: memberColorMap[member.id] || undefined,
                    border: member.is_guest
                      ? "1px dashed #888"
                      : member.id === currentMembership.id
                        ? "2px solid #ef4444"
                        : undefined,
                  }}
                >
                  {member.is_master && <Crown className="h-3 w-3" />}
                  {member.display_name}
                  {member.is_guest && <span className="text-xs text-muted-foreground">(ゲスト)</span>}
                  {member.id === currentMembership.id && " (あなた)"}
                  {canDeleteMember(member) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {member.display_name}を削除しますか？
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            このメンバーの注文データも削除されます。この操作は取り消せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMember(member.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              注文を追加
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-sm">メンバー *</Label>
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="メンバーを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全員に追加</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.display_name}
                          {m.is_guest && " (ゲスト)"}
                          {m.id === currentMembership.id && " (あなた)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">商品名（任意）</Label>
                  <Input placeholder="例: ビール" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">金額 *</Label>
                  <Input
                    type="number"
                    placeholder="500"
                    required
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm">数量</Label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">注文一覧</CardTitle>

            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <Select
                  value={filterMember}
                  onValueChange={(v) => {
                    setFilterMember(v)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全員</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="検索..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">並び替え</span>
                <Select
                  value={sortField}
                  onValueChange={(v) => {
                    setSortField(v as SortField)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="display_name">名前順</SelectItem>
                    <SelectItem value="created_at">登録順</SelectItem>
                    <SelectItem value="unit_price">金額</SelectItem>
                    <SelectItem value="quantity">数量</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  {sortDirection === "asc" ? "昇順" : "降順"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paginatedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || filterMember !== "__all__" ? "該当する注文はありません" : "注文はありません"}
              </p>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {paginatedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-3"
                      style={{ backgroundColor: memberColorMap[order.member_id] ? `${memberColorMap[order.member_id]}50` : undefined }}
                    >
                      {editingOrderId === order.id && editForm ? (
                        <div className="space-y-2">
                          <Select
                            value={editForm.member_id}
                            onValueChange={(v) => setEditForm({ ...editForm, member_id: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="商品名"
                            value={editForm.item_name}
                            onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="単価"
                              min="0"
                              value={editForm.unit_price}
                              onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                            />
                            <Input
                              type="number"
                              placeholder="数量"
                              min="1"
                              className="w-20"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="font-bold">
                              {formatCurrency((Number.parseInt(editForm.unit_price) || 0) * (Number.parseInt(editForm.quantity) || 1))}
                            </span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={() => saveEdit(order.id)}>
                                <Save className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">{order.member?.display_name}</span>
                              {order.item_name && (
                                <span className="text-muted-foreground text-sm truncate">- {order.item_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">{formatCurrency(order.unit_price)} × {order.quantity}</span>
                              <span className="font-bold text-primary">{formatCurrency(order.line_total)}</span>
                            </div>
                          </div>
                          {canManageOrder(order) && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(order)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>注文を削除しますか？</AlertDialogTitle>
                                    <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      削除する
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名前</TableHead>
                        <TableHead>商品名</TableHead>
                        <TableHead className="text-right">単価</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">小計</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => (
                        <TableRow key={order.id}>
                          {editingOrderId === order.id && editForm ? (
                            <>
                              <TableCell>
                                <Select
                                  value={editForm.member_id}
                                  onValueChange={(v) => setEditForm({ ...editForm, member_id: v })}
                                >
                                  <SelectTrigger className="h-8 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {members.map((m) => (
                                      <SelectItem key={m.id} value={m.id}>
                                        {m.display_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  value={editForm.item_name}
                                  onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="h-8 w-24 text-right"
                                  min="0"
                                  value={editForm.unit_price}
                                  onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="h-8 w-20 text-right"
                                  min="1"
                                  value={editForm.quantity}
                                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(
                                  (Number.parseInt(editForm.unit_price) || 0) * (Number.parseInt(editForm.quantity) || 1),
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(order.id)}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-medium">
                                <span
                                  className="inline-flex px-2 py-1 rounded-md"
                                  style={{ backgroundColor: memberColorMap[order.member_id] || undefined }}
                                >
                                  {order.member?.display_name}
                                </span>
                              </TableCell>
                              <TableCell>{order.item_name || <span className="text-muted-foreground">-</span>}</TableCell>
                              <TableCell className="text-right">{formatCurrency(order.unit_price)}</TableCell>
                              <TableCell className="text-right">{order.quantity}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(order.line_total)}</TableCell>
                              <TableCell>
                                {canManageOrder(order) && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => startEdit(order)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>注文を削除しますか？</AlertDialogTitle>
                                          <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteOrder(order.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            削除する
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      前へ
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              サマリー
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">合計数量</p>
                <p className="text-2xl font-bold">{totals.totalQuantity}点</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">合計金額</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium">簡単割り勘</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder={String(members.length)}
                    value={splitPeopleCount}
                    onChange={(e) => setSplitPeopleCount(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">人で割る</span>
                </div>
                <div className="flex items-center justify-between sm:ml-auto">
                  <span className="text-sm text-muted-foreground sm:hidden">一人あたり</span>
                  <span className="text-xl font-bold text-primary">
                    <span className="hidden sm:inline">一人あたり: </span>
                    {formatCurrency(
                      Math.ceil(totals.totalAmount / (Number(splitPeopleCount) || members.length))
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">メンバー別内訳</h4>
              <div className="space-y-2">
                {totals.byMember.map(({ member, quantity, amount }) => (
                  <AlertDialog key={member.id}>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded text-left border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        style={{ backgroundColor: memberColorMap[member.id] || undefined }}
                      >
                        <span className="font-semibold leading-tight break-words">{member.display_name}</span>
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                          <span className="text-xs text-muted-foreground sm:hidden">タップで詳細</span>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <span>商品点数</span>
                            <span className="font-semibold text-foreground">{quantity}点</span>
                          </div>
                          <span className="font-bold text-right text-base sm:text-lg min-w-[90px]">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{member.display_name}</AlertDialogTitle>
                        <AlertDialogDescription>メンバー別内訳</AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">商品点数</span>
                          <span className="font-medium">{quantity}点</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">合計金額</span>
                          <span className="font-bold text-xl">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>閉じる</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
