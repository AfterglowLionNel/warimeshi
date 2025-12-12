"use client"

import type React from "react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useSoloSession } from "@/lib/hooks/use-solo-session"
import { formatCurrency } from "@/lib/utils/format"
import type { SortField, SortDirection } from "@/lib/types/solo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { ArrowLeft, Plus, Trash2, ArrowUpDown, History, Search, Calculator, Loader2 } from "lucide-react"

const ITEMS_PER_PAGE = 10

export default function SoloSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { session, isLoading, addOrder, deleteOrder, clearAllOrders } = useSoloSession(sessionId)

  // Form state
  const [itemName, setItemName] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)

  // Split calculation state
  const [splitCount, setSplitCount] = useState("1")

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = Number.parseInt(unitPrice, 10)
    const qty = Number.parseInt(quantity, 10) || 1

    if (isNaN(price) || price <= 0) return

    addOrder({
      itemName: itemName.trim(),
      unitPrice: price,
      quantity: qty,
    })

    // Reset form
    setItemName("")
    setUnitPrice("")
    setQuantity("1")
  }

  // Filtered and sorted orders
  const processedOrders = useMemo(() => {
    if (!session) return []

    let orders = [...session.orders]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      orders = orders.filter((o) => o.itemName.toLowerCase().includes(query))
    }

    // Sort
    orders.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "itemName":
          comparison = a.itemName.localeCompare(b.itemName, "ja")
          break
        case "unitPrice":
          comparison = a.unitPrice - b.unitPrice
          break
        case "quantity":
          comparison = a.quantity - b.quantity
          break
        case "createdAt":
        default:
          comparison = a.createdAt - b.createdAt
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return orders
  }, [session, searchQuery, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE)
  const paginatedOrders = processedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  // Totals
  const totals = useMemo(() => {
    if (!session) return { quantity: 0, amount: 0 }
    return session.orders.reduce(
      (acc, order) => ({
        quantity: acc.quantity + order.quantity,
        amount: acc.amount + order.lineTotal,
      }),
      { quantity: 0, amount: 0 },
    )
  }, [session])

  // Split amount
  const splitAmount = useMemo(() => {
    const count = Number.parseInt(splitCount, 10) || 1
    return Math.round(totals.amount / count)
  }, [totals.amount, splitCount])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col pb-4">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
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
              <h1 className="text-xl font-bold text-primary">{session?.name}</h1>
              <p className="text-xs text-muted-foreground">
                {session && new Date(session.createdAt).toLocaleDateString("ja-JP")}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/solo/history">
                <History className="h-4 w-4 mr-1" />
                履歴
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 space-y-4">
        {/* Add Order Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              注文を追加
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="itemName" className="text-sm">
                    商品名（任意）
                  </Label>
                  <Input
                    id="itemName"
                    placeholder="例: ビール"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="unitPrice" className="text-sm">
                    金額 *
                  </Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    placeholder="500"
                    required
                    min="1"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="quantity" className="text-sm">
                    数量
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">注文一覧</CardTitle>
              {session && session.orders.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      全削除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>全ての注文を削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消せません。全ての注文データが削除されます。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearAllOrders}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        削除する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Search */}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="商品名で検索..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">並び替え:</span>
              <Select
                value={sortField}
                onValueChange={(v) => {
                  setSortField(v as SortField)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">登録順</SelectItem>
                  <SelectItem value="itemName">商品名</SelectItem>
                  <SelectItem value="unitPrice">金額</SelectItem>
                  <SelectItem value="quantity">数量</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}>
                <ArrowUpDown className="h-4 w-4" />
                {sortDirection === "asc" ? "昇順" : "降順"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {paginatedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? "検索結果がありません" : "注文がありません"}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 px-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">商品名</TableHead>
                        <TableHead className="text-right">単価</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">小計</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.itemName || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(order.unitPrice)}</TableCell>
                          <TableCell className="text-right">{order.quantity}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(order.lineTotal)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteOrder(order.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
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

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              合計・割り勘
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">合計数量</p>
                <p className="text-2xl font-bold">{totals.quantity}点</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">合計金額</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totals.amount)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label htmlFor="splitCount" className="text-sm">
                割り勘人数
              </Label>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  id="splitCount"
                  type="number"
                  min="1"
                  className="w-24"
                  value={splitCount}
                  onChange={(e) => setSplitCount(e.target.value)}
                />
                <span className="text-muted-foreground">人</span>
              </div>
              <div className="mt-3 p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">一人あたり</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(splitAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
