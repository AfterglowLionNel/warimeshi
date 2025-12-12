"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
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
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

interface TableDetailClientProps {
  table: Table
  currentUser: User
  currentMembership: TableMember
  initialMembers: (TableMember & { user?: User })[]
  initialOrders: (Order & { member?: TableMember })[]
}

type SortField = "display_name" | "unit_price" | "quantity" | "created_at"
type SortDirection = "asc" | "desc"

const ITEMS_PER_PAGE = 10
const POLL_INTERVAL = 5000
const MEMBER_COLORS = ["#e0f2fe", "#fef9c3", "#f5f3ff", "#ecfccb", "#f1f5f9", "#ffe4e6", "#f0f9ff", "#fef2f2"]

export function TableDetailClient({
  table,
  currentUser,
  currentMembership,
  initialMembers,
  initialOrders,
}: TableDetailClientProps) {
  const supabase = createClient()
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

  const memberColorMap = useMemo(() => {
    const sortedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
    return sortedMembers.reduce<Record<string, string>>((acc, member, idx) => {
      acc[member.id] = MEMBER_COLORS[idx % MEMBER_COLORS.length]
      return acc
    }, {})
  }, [members])

  useEffect(() => {
    const fetchUpdates = async () => {
      const [membersRes, ordersRes] = await Promise.all([
        supabase
          .from("table_members")
          .select("*, user:users(*)")
          .eq("table_id", table.id)
          .order("joined_at", { ascending: true }),
        supabase
          .from("orders")
          .select("*, member:table_members(*)")
          .eq("table_id", table.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ])

      if (membersRes.data) setMembers(membersRes.data)
      if (ordersRes.data) setOrders(ordersRes.data)
    }

    const interval = setInterval(fetchUpdates, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [table.id, supabase])

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
      if (selectedMember === "__all__") {
        const inserts = members.map((m) => ({
          table_id: table.id,
          created_by_user_id: currentUser.id,
          member_id: m.id,
          item_name: itemName.trim() || null,
          unit_price: price,
          quantity: qty,
          line_total: price * qty,
        }))

        const { error } = await supabase.from("orders").insert(inserts)
        if (error) throw error
      } else {
        const { error } = await supabase.from("orders").insert({
          table_id: table.id,
          created_by_user_id: currentUser.id,
          member_id: selectedMember,
          item_name: itemName.trim() || null,
          unit_price: price,
          quantity: qty,
          line_total: price * qty,
        })
        if (error) throw error
      }

      setItemName("")
      setUnitPrice("")
      setQuantity("1")
      toast.success("注文を追加しました")

      const { data } = await supabase
        .from("orders")
        .select("*, member:table_members(*)")
        .eq("table_id", table.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (data) setOrders(data)
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
      const { error } = await supabase
        .from("orders")
        .update({
          member_id: editForm.member_id,
          item_name: editForm.item_name.trim() || null,
          unit_price: price,
          quantity: qty,
          line_total: price * qty,
        })
        .eq("id", orderId)

      if (error) throw error

      toast.success("注文を更新しました")
      cancelEdit()

      const { data } = await supabase
        .from("orders")
        .select("*, member:table_members(*)")
        .eq("table_id", table.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (data) setOrders(data)
    } catch (error) {
      console.error("Error updating order:", error)
      toast.error("更新に失敗しました")
    }
  }

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", orderId)

      if (error) throw error

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
          <CardContent className="p-4">
            <Label className="text-sm text-muted-foreground">招待リンク</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/group/join/${table.invite_token}`}
                readOnly
                className="text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              メンバー ({members.length}人)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <Badge
                  key={member.id}
                  variant={member.id === currentMembership.id ? "default" : "secondary"}
                  className="flex items-center gap-1 text-black"
                  style={{
                    backgroundColor: memberColorMap[member.id] || undefined,
                    border: member.id === currentMembership.id ? "2px solid #ef4444" : undefined,
                  }}
                >
                  {member.is_master && <Crown className="h-3 w-3" />}
                  {member.display_name}
                  {member.id === currentMembership.id && " (あなた)"}
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
                <div className="overflow-x-auto -mx-4 px-4">
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">名前</TableHead>
                        <TableHead className="min-w-[120px]">商品名</TableHead>
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
