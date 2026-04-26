"use client"

import type React from "react"
import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useSoloSession } from "@/lib/hooks/use-solo-session"
import { formatCurrency } from "@/lib/utils/format"
import type { SortField, SortDirection } from "@/lib/types/solo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Trash2,
  ArrowUpDown,
  History,
  Search,
  Loader2,
  MoreHorizontal,
  Calculator,
} from "lucide-react"

const ITEMS_PER_PAGE = 10

type Tab = "orders" | "split" | "memo"

export default function SoloSessionPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { session, isLoading, addOrder, deleteOrder, clearAllOrders, updateMemo } = useSoloSession(sessionId)

  const [tab, setTab] = useState<Tab>("orders")

  // form
  const [itemName, setItemName] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")

  // filter / sort
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)

  // split
  const [splitCount, setSplitCount] = useState("4")

  // memo (autosave)
  const [memoDraft, setMemoDraft] = useState("")
  const [memoStatus, setMemoStatus] = useState<"idle" | "saving" | "saved">("idle")
  const memoHydrated = useRef(false)
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // メモを最初に hydrate (session 読み込み完了時に 1 度だけ)
  useEffect(() => {
    if (!session || memoHydrated.current) return
    setMemoDraft(session.memo ?? "")
    memoHydrated.current = true
  }, [session])

  // メモを 600ms デバウンスで autosave
  useEffect(() => {
    if (!memoHydrated.current || !session) return
    if ((session.memo ?? "") === memoDraft) return
    setMemoStatus("saving")
    if (memoTimer.current) clearTimeout(memoTimer.current)
    memoTimer.current = setTimeout(() => {
      updateMemo(memoDraft)
      setMemoStatus("saved")
      if (savedHideTimer.current) clearTimeout(savedHideTimer.current)
      savedHideTimer.current = setTimeout(() => setMemoStatus("idle"), 1500)
    }, 600)
    return () => {
      if (memoTimer.current) clearTimeout(memoTimer.current)
    }
  }, [memoDraft, session, updateMemo])

  useEffect(() => {
    return () => {
      if (memoTimer.current) clearTimeout(memoTimer.current)
      if (savedHideTimer.current) clearTimeout(savedHideTimer.current)
    }
  }, [])

  // clear confirm
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = Number.parseInt(unitPrice, 10)
    const qty = Number.parseInt(quantity, 10) || 1
    if (isNaN(price) || price <= 0) return
    addOrder({ itemName: itemName.trim(), unitPrice: price, quantity: qty })
    setItemName("")
    setUnitPrice("")
    setQuantity("1")
  }

  const processedOrders = useMemo(() => {
    if (!session) return []
    let orders = [...session.orders]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      orders = orders.filter((o) => o.itemName.toLowerCase().includes(q))
    }
    orders.sort((a, b) => {
      let c = 0
      switch (sortField) {
        case "itemName":
          c = a.itemName.localeCompare(b.itemName, "ja")
          break
        case "unitPrice":
          c = a.unitPrice - b.unitPrice
          break
        case "quantity":
          c = a.quantity - b.quantity
          break
        case "createdAt":
        default:
          c = a.createdAt - b.createdAt
      }
      return sortDirection === "asc" ? c : -c
    })
    return orders
  }, [session, searchQuery, sortField, sortDirection])

  const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE)
  const paginatedOrders = processedOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const totals = useMemo(() => {
    if (!session) return { quantity: 0, amount: 0, count: 0 }
    const t = session.orders.reduce(
      (acc, o) => ({ quantity: acc.quantity + o.quantity, amount: acc.amount + o.lineTotal }),
      { quantity: 0, amount: 0 },
    )
    return { ...t, count: session.orders.length }
  }, [session])

  const splitN = Math.max(1, Number.parseInt(splitCount, 10) || 1)
  const splitAmount = Math.ceil(totals.amount / splitN)

  const dateLabel = useMemo(() => {
    if (!session) return ""
    const d = new Date(session.createdAt)
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]}) の記録`
  }, [session])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-[200px]">
      <div className="mx-auto w-full max-w-md px-4 pt-5">
        {/* header */}
        <div className="flex items-center gap-2">
          <Link
            href="/solo"
            aria-label="戻る"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-[var(--wm-surface)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="text-[12px] text-[var(--wm-ink-3)]">ソロモード · 自動保存</div>
            <div className="mt-0.5 text-[16px] font-semibold leading-tight">{dateLabel}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="メニュー"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--wm-ink-2)] hover:bg-[var(--wm-surface)]"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/solo/history">
                  <History className="mr-2 h-4 w-4" />
                  履歴を見る
                </Link>
              </DropdownMenuItem>
              {totals.count > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmClearOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    全削除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* dark total card */}
        <div className="mt-4 rounded-2xl p-5" style={{ background: "var(--wm-ink)", color: "#fff" }}>
          <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">合計金額</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[13px] opacity-70">¥</span>
            <span className="wm-num text-[38px] font-bold leading-none tracking-tight">
              {totals.amount.toLocaleString()}
            </span>
          </div>
          <div className="mt-3.5 flex items-center gap-4 text-[12px] opacity-80">
            <span>
              <span className="wm-num font-semibold">{totals.count}</span> 品
            </span>
            <span>
              <span className="wm-num font-semibold">{totals.quantity}</span> 個
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <Calculator className="h-3 w-3" />
              {splitN}人で割り勘
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[10px] bg-white/[0.06] p-3">
            <span className="text-[12px] opacity-70">1人あたり</span>
            <span className="wm-num text-[22px] font-bold">¥{splitAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* tabs */}
        <div className="mt-4">
          <div className="wm-tabs">
            <button
              className={`wm-tab ${tab === "orders" ? "is-active" : ""}`}
              onClick={() => setTab("orders")}
            >
              注文 ({totals.count})
            </button>
            <button
              className={`wm-tab ${tab === "split" ? "is-active" : ""}`}
              onClick={() => setTab("split")}
            >
              割り勘
            </button>
            <button
              className={`wm-tab ${tab === "memo" ? "is-active" : ""}`}
              onClick={() => setTab("memo")}
            >
              メモ
            </button>
          </div>
        </div>

        {/* tab content */}
        {tab === "orders" && (
          <div className="mt-3">
            {/* sort/search row (compact) */}
            {totals.count > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wm-ink-3)]" />
                  <Input
                    placeholder="検索"
                    className="h-9 pl-8 text-[13px]"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
                <Select
                  value={sortField}
                  onValueChange={(v) => {
                    setSortField(v as SortField)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-9 w-[110px] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">登録順</SelectItem>
                    <SelectItem value="itemName">商品名</SelectItem>
                    <SelectItem value="unitPrice">金額</SelectItem>
                    <SelectItem value="quantity">数量</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-card"
                  onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                  aria-label={sortDirection === "asc" ? "昇順" : "降順"}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            {paginatedOrders.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--wm-line-strong)] bg-[var(--wm-surface)]/40 px-4 py-10 text-center">
                <div className="text-[14px] font-medium text-foreground">
                  {searchQuery ? "検索結果がありません" : "まだ注文がありません"}
                </div>
                <div className="mt-1 text-[12px] text-[var(--wm-ink-3)]">
                  下のフォームから追加してください
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-[var(--wm-line)] bg-card">
                {paginatedOrders.map((order, i) => (
                  <div
                    key={order.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-[var(--wm-line)]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-medium">
                        {order.itemName || <span className="text-[var(--wm-ink-3)]">(名称なし)</span>}
                      </div>
                      <div className="wm-num mt-0.5 text-[12px] text-[var(--wm-ink-3)]">
                        ¥{order.unitPrice.toLocaleString()} × {order.quantity}
                      </div>
                    </div>
                    <span className="wm-num min-w-[64px] text-right text-[14px] font-semibold">
                      {formatCurrency(order.lineTotal)}
                    </span>
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wm-ink-3)] transition hover:bg-[var(--wm-surface)] hover:text-destructive"
                      onClick={() => deleteOrder(order.id)}
                      aria-label="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  前へ
                </Button>
                <span className="wm-num text-[13px] text-[var(--wm-ink-2)]">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  次へ
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "split" && (
          <div className="mt-3 wm-card p-5">
            <label htmlFor="splitCount" className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
              人数
            </label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                id="splitCount"
                type="number"
                min="1"
                inputMode="numeric"
                className="wm-num h-11 w-28 text-center text-lg font-semibold"
                value={splitCount}
                onChange={(e) => setSplitCount(e.target.value)}
              />
              <span className="text-[var(--wm-ink-2)]">人で割る</span>
            </div>
            <div className="mt-4 rounded-[12px] bg-[var(--wm-accent-soft)] p-4">
              <div className="text-[11px] font-semibold text-[var(--wm-accent-pressed)]">
                1人あたり
              </div>
              <div className="wm-num mt-1 text-[28px] font-bold text-[var(--wm-accent-pressed)]">
                {formatCurrency(splitAmount)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-[10px] bg-[var(--wm-surface)] p-3">
                <div className="text-[11px] text-[var(--wm-ink-3)]">合計</div>
                <div className="wm-num mt-0.5 font-semibold">{formatCurrency(totals.amount)}</div>
              </div>
              <div className="rounded-[10px] bg-[var(--wm-surface)] p-3">
                <div className="text-[11px] text-[var(--wm-ink-3)]">注文数</div>
                <div className="wm-num mt-0.5 font-semibold">{totals.count} 品 / {totals.quantity} 個</div>
              </div>
            </div>
          </div>
        )}

        {tab === "memo" && (
          <div className="mt-3">
            <div className="wm-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="memo" className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
                  メモ
                </label>
                <span
                  className={`text-[11px] transition-opacity ${
                    memoStatus === "idle" ? "opacity-0" : "opacity-100"
                  }`}
                  style={{ color: memoStatus === "saved" ? "var(--wm-success)" : "var(--wm-ink-3)" }}
                  aria-live="polite"
                >
                  {memoStatus === "saving" && "保存中…"}
                  {memoStatus === "saved" && "✓ 保存しました"}
                </span>
              </div>
              <textarea
                id="memo"
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                placeholder="お店の名前、参加メンバー、合意した割り勘ルールなどを自由に記録できます"
                rows={10}
                className="w-full resize-none rounded-[10px] border border-[var(--wm-line)] bg-card px-3 py-2.5 text-[14px] leading-relaxed text-foreground outline-none transition focus:border-[var(--wm-ink)] focus:ring-2 focus:ring-[var(--wm-accent-soft)]"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--wm-ink-3)]">
                <span>自動保存 · 端末内のみに保存</span>
                <span className="wm-num">{memoDraft.length} 文字</span>
              </div>
            </div>

            {/* よく使うテンプレ */}
            <div className="mt-3 wm-card p-4">
              <div className="mb-2 text-[11px] font-bold tracking-[.08em] text-[var(--wm-ink-3)]">
                定型文を挿入
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "お店", text: "お店：" },
                  { label: "日時", text: "日時：" },
                  { label: "参加者", text: "参加者：" },
                  { label: "幹事", text: "幹事：" },
                  { label: "支払い方法", text: "支払い方法：" },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => {
                      const prefix = memoDraft.length === 0 || memoDraft.endsWith("\n") ? "" : "\n"
                      setMemoDraft((d) => d + prefix + t.text)
                    }}
                    className="rounded-full border border-[var(--wm-line-strong)] bg-card px-3 py-1 text-[12px] font-medium text-[var(--wm-ink-2)] transition hover:bg-[var(--wm-surface)]"
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* floating add bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 wm-safe-bottom"
        style={{
          background: "linear-gradient(to top, var(--wm-bg) 70%, rgba(250,250,247,0))",
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-[14px] border border-[var(--wm-line)] bg-card p-2 shadow-md"
          >
            <Input
              placeholder="商品名"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="flex-1 border-0 bg-transparent px-2 text-[14px] focus-visible:ring-0"
            />
            <Input
              placeholder="¥"
              type="number"
              inputMode="numeric"
              min="1"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="wm-num w-20 border-0 bg-[var(--wm-surface)] px-2 text-right text-[14px] focus-visible:ring-0"
            />
            <Input
              placeholder="数"
              type="number"
              min="1"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="wm-num w-12 border-0 bg-[var(--wm-surface)] px-2 text-center text-[14px] focus-visible:ring-0"
            />
            <Button type="submit" size="icon" className="h-10 w-10 rounded-[10px]">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
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
              onClick={() => {
                clearAllOrders()
                setConfirmClearOpen(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
