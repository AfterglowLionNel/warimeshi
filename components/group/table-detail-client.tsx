"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Order, Table, TableMember, User } from "@/lib/types/group"
import { useTableEvents } from "@/lib/hooks/use-table-events"
import { PaymentTracker } from "./payment-tracker"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Check,
  Copy,
  Crown,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Radio,
  Save,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { InviteQRCode } from "./invite-qr-code"
import { InviteShareButton } from "./invite-share-button"
import { getGuestToken } from "@/lib/guest/guest-session"
import { useFunAdjustmentRoulette, type RouletteResult } from "./use-fun-adjustment-roulette"

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

type ApiUser = {
  id: string
  email?: string | null
  nickname?: string | null
  isAdmin?: boolean
  is_admin?: boolean
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

type ApiTableMember = {
  id: string
  tableId?: string
  table_id?: string
  userId?: string | null
  user_id?: string | null
  displayName?: string
  display_name?: string
  isMaster?: boolean
  is_master?: boolean
  isGuest?: boolean
  is_guest?: boolean
  addedByUserId?: string | null
  added_by_user_id?: string | null
  joinedAt?: string
  joined_at?: string
  user?: ApiUser
}

type ApiOrder = {
  id: string
  tableId?: string
  table_id?: string
  memberId?: string
  member_id?: string
  createdByUserId?: string | null
  created_by_user_id?: string | null
  itemName?: string | null
  item_name?: string | null
  unitPrice?: number
  unit_price?: number
  quantity: number
  lineTotal?: number
  line_total?: number
  isShared?: boolean
  is_shared?: boolean
  sharedGroupId?: string | null
  shared_group_id?: string | null
  deletedAt?: string | null
  deleted_at?: string | null
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  member?: ApiTableMember
}

type ApiListResponse<T> = {
  data?: T[]
}

type OrderInsert = {
  table_id: string
  member_id: string
  member_ids?: string[]
  item_name: string | null
  unit_price: number
  quantity: number
  line_total: number
}

type FunAdjustmentType =
  | "none"
  | "remainder_roulette"
  | "lucky_discount"
  | "organizer_bonus"
  | "full_burden_roulette"

type FunAdjustment = {
  type: FunAdjustmentType
  targetMemberId?: string
  amount?: number
}

const ITEMS_PER_PAGE = 10
const MEMBER_COLORS = ["#e0f2fe", "#fef9c3", "#ede9fe", "#dcfce7", "#f1f5f9", "#ffe4e6", "#dbeafe", "#fee2e2"]

function normalizeFunAdjustment(value: unknown): FunAdjustment {
  if (!value || typeof value !== "object") return { type: "none" }

  const raw = value as Partial<FunAdjustment>
  const validTypes: FunAdjustmentType[] = [
    "none",
    "remainder_roulette",
    "lucky_discount",
    "organizer_bonus",
    "full_burden_roulette",
  ]
  const type = raw.type && validTypes.includes(raw.type) ? raw.type : "none"
  if (type === "none") return { type: "none" }

  return {
    type,
    targetMemberId: typeof raw.targetMemberId === "string" ? raw.targetMemberId : undefined,
    amount: typeof raw.amount === "number" && Number.isFinite(raw.amount) ? raw.amount : undefined,
  }
}

// Helper to map API response (camelCase) to component format (snake_case)
function mapMemberFromApi(m: ApiTableMember): TableMember & { user?: User } {
  return {
    id: m.id,
    table_id: m.tableId ?? m.table_id ?? "",
    user_id: m.userId ?? m.user_id ?? null,
    display_name: m.displayName ?? m.display_name ?? "",
    is_master: m.isMaster ?? m.is_master ?? false,
    is_guest: m.isGuest ?? m.is_guest ?? false,
    added_by_user_id: m.addedByUserId ?? m.added_by_user_id ?? null,
    joined_at: m.joinedAt ?? m.joined_at ?? "",
    user: m.user ? {
      id: m.user.id,
      firebase_uid: m.user.id,
      email: m.user.email ?? null,
      nickname: m.user.nickname ?? null,
      is_admin: m.user.isAdmin ?? m.user.is_admin ?? false,
      created_at: m.user.createdAt ?? m.user.created_at ?? "",
      updated_at: m.user.updatedAt ?? m.user.updated_at ?? "",
    } : undefined,
  }
}

function mapOrderFromApi(o: ApiOrder): Order & { member?: TableMember } {
  return {
    id: o.id,
    table_id: o.tableId ?? o.table_id ?? "",
    member_id: o.memberId ?? o.member_id ?? "",
    created_by_user_id: o.createdByUserId ?? o.created_by_user_id ?? null,
    item_name: o.itemName ?? o.item_name ?? null,
    unit_price: o.unitPrice ?? o.unit_price ?? 0,
    quantity: o.quantity,
    line_total: o.lineTotal ?? o.line_total ?? 0,
    is_shared: o.isShared ?? o.is_shared ?? false,
    shared_group_id: o.sharedGroupId ?? o.shared_group_id ?? null,
    deleted_at: o.deletedAt ?? o.deleted_at ?? null,
    created_at: o.createdAt ?? o.created_at ?? "",
    updated_at: o.updatedAt ?? o.updated_at ?? "",
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
  isGuestUser: _isGuestUser = false,
}: TableDetailClientProps) {
  const isTableOwner = table.owner_user_id === currentUser.id

  const [members, setMembers] = useState(initialMembers)
  const [orders, setOrders] = useState(initialOrders)
  const [isCopied, setIsCopied] = useState(false)
  // リデザイン用 UI 状態
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addOrderOpen, setAddOrderOpen] = useState(false)
  const [showAllOrders, setShowAllOrders] = useState(false)

  const [selectedMembers, setSelectedMembers] = useState<string[]>([currentMembership.id])
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

  // Group edit state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupForm, setEditGroupForm] = useState<{
    item_name: string
    total_amount: string
  } | null>(null)

  // Settlement state
  const [payerId, setPayerId] = useState<string>(currentMembership.id)
  const [splitMode, setSplitMode] = useState<"equal" | "weighted">("equal")
  const [memberWeights, setMemberWeights] = useState<Record<string, "more" | "normal" | "less">>({})
  const [exemptMemberId, setExemptMemberId] = useState<string | null>(null)
  const [showFunAdjustments, setShowFunAdjustments] = useState(false)
  const [funAdjustment, setFunAdjustment] = useState<FunAdjustment>({ type: "none" })
  const handleRouletteResult = useCallback((result: RouletteResult) => {
    setFunAdjustment({
      type: result.type,
      targetMemberId: result.targetMemberId,
      amount: result.amount,
    })
  }, [])
  const {
    spinningAdjustmentType,
    roulettePreviewMemberId,
    roulettePreviewSlotIndex,
    rouletteOffset,
    rouletteConfettiBurst,
    rouletteCandidates,
    rouletteMembers,
    runRandomFunAdjustment,
  } = useFunAdjustmentRoulette({
    members,
    exemptMemberId,
    onResult: handleRouletteResult,
  })

  // Guest member state
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [isAddingGuest, setIsAddingGuest] = useState(false)

  // Lock state
  const [isLocked, setIsLocked] = useState(table.is_locked)
  const [autoLockAt, setAutoLockAt] = useState<string | null>(table.auto_lock_at)
  const [isTogglingLock, setIsTogglingLock] = useState(false)

  // Payment refresh trigger
  const [paymentRefresh, setPaymentRefresh] = useState(0)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Load shared settlement settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`/api/payments?tableId=${table.id}`, { headers: getApiHeaders() })
        if (res.ok) {
          const json = await res.json()
          if (json.settings) {
            if (json.settings.payerId) setPayerId(json.settings.payerId)
            if (json.settings.splitMode) setSplitMode(json.settings.splitMode as "equal" | "weighted")
            if (json.settings.memberWeights) setMemberWeights(json.settings.memberWeights)
            setExemptMemberId(typeof json.settings.exemptMemberId === "string" ? json.settings.exemptMemberId : null)
            if (json.settings.funAdjustment) setFunAdjustment(normalizeFunAdjustment(json.settings.funAdjustment))
          }
        }
      } catch {
        // ignore
      } finally {
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate effective lock status
  const isEffectivelyLocked = isLocked || (autoLockAt && new Date(autoLockAt) < new Date())

  const memberColorMap = useMemo(() => {
    const sortedMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
    return sortedMembers.reduce<Record<string, string>>((acc, member, idx) => {
      acc[member.id] = MEMBER_COLORS[idx % MEMBER_COLORS.length]
      return acc
    }, {})
  }, [members])

  const fetchUpdates = useCallback(async () => {
    const headers = getApiHeaders()
    try {
      const [membersRes, ordersRes] = await Promise.all([
        fetch(`/api/table-members?tableId=${table.id}`, { headers }),
        fetch(`/api/orders?tableId=${table.id}`, { headers }),
      ])

      if (membersRes.ok) {
        const json = (await membersRes.json()) as ApiListResponse<ApiTableMember>
        if (json.data) setMembers(json.data.map(mapMemberFromApi))
      }
      if (ordersRes.ok) {
        const json = (await ordersRes.json()) as ApiListResponse<ApiOrder>
        if (json.data) setOrders(json.data.map(mapOrderFromApi))
      }
    } catch (err) {
      console.error("Failed to fetch updates", err)
    }
  }, [table.id])

  // SSE real-time updates (with polling fallback)
  // ゲストトークンは HttpOnly Cookie から自動送信されるため、URL クエリでは渡さない。
  useTableEvents({
    tableId: table.id,
    onEvent: useCallback(() => {
      fetchUpdates()
    }, [fetchUpdates]),
  })

  // Initial fetch
  useEffect(() => {
    fetchUpdates()
  }, [fetchUpdates])

  useEffect(() => {
    setFunAdjustment((prev) => {
      const eligibleMembers = members.filter((member) => member.id !== exemptMemberId)
      if (
        (prev.type === "remainder_roulette" || prev.type === "lucky_discount") &&
        eligibleMembers.length < 2
      ) {
        return { type: "none" }
      }
      if (prev.type === "organizer_bonus" && prev.targetMemberId !== payerId) {
        return { ...prev, targetMemberId: payerId, amount: prev.amount || 500 }
      }
      if (
        prev.type !== "none" &&
        prev.targetMemberId &&
        (!members.some((m) => m.id === prev.targetMemberId) || prev.targetMemberId === exemptMemberId)
      ) {
        return { type: "none" }
      }
      return prev
    })
  }, [members, payerId, exemptMemberId])

  useEffect(() => {
    if (exemptMemberId && !members.some((m) => m.id === exemptMemberId)) {
      setExemptMemberId(null)
    }
  }, [exemptMemberId, members])

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

    if (selectedMembers.length === 0) {
      toast.error("メンバーを選択してください")
      return
    }

    setIsSubmitting(true)

    try {
      const lineTotal = price * qty
      let inserts: OrderInsert[]

      if (selectedMembers.length === 1) {
        inserts = [{
          table_id: table.id,
          member_id: selectedMembers[0],
          item_name: itemName.trim() || null,
          unit_price: price,
          quantity: qty,
          line_total: lineTotal,
        }]
      } else {
        // Multiple members: send member_ids for the API to split
        inserts = [{
          table_id: table.id,
          member_id: selectedMembers[0],
          member_ids: selectedMembers,
          item_name: itemName.trim() || null,
          unit_price: price,
          quantity: qty,
          line_total: lineTotal,
        }]
      }

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
        const json = (await refreshed.json()) as ApiListResponse<ApiOrder>
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
        const json = (await refreshed.json()) as ApiListResponse<ApiOrder>
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

  // Group orders by shared_group_id for display
  type DisplayOrder = {
    key: string
    orders: (Order & { member?: TableMember })[]
    memberNames: string[]
    itemName: string | null
    totalAmount: number
    perPerson: number
    isGrouped: boolean
  }

  const startGroupEdit = (displayOrder: DisplayOrder) => {
    setEditingGroupId(displayOrder.key)
    setEditGroupForm({
      item_name: displayOrder.itemName || "",
      total_amount: displayOrder.totalAmount.toString(),
    })
  }

  const cancelGroupEdit = () => {
    setEditingGroupId(null)
    setEditGroupForm(null)
  }

  const saveGroupEdit = async (displayOrder: DisplayOrder) => {
    if (!editGroupForm) return

    const newTotal = Number.parseInt(editGroupForm.total_amount, 10)
    if (isNaN(newTotal) || newTotal < 0) {
      toast.error("金額を正しく入力してください")
      return
    }

    const memberCount = displayOrder.orders.length
    const perPerson = Math.floor(newTotal / memberCount)
    const remainder = newTotal - perPerson * memberCount

    try {
      for (let i = 0; i < displayOrder.orders.length; i++) {
        const o = displayOrder.orders[i]
        const amount = perPerson + (i < remainder ? 1 : 0)
        const res = await fetch(`/api/orders/${o.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({
            updates: {
              item_name: editGroupForm.item_name.trim() || null,
              unit_price: amount,
              quantity: 1,
              line_total: amount,
            },
          }),
        })
        if (!res.ok) {
          throw new Error("更新に失敗しました")
        }
      }

      toast.success("注文を更新しました")
      cancelGroupEdit()

      const refreshed = await fetch(`/api/orders?tableId=${table.id}`, { headers: getApiHeaders() })
      if (refreshed.ok) {
        const json = (await refreshed.json()) as ApiListResponse<ApiOrder>
        if (json.data) setOrders(json.data.map(mapOrderFromApi))
      }
    } catch (error) {
      console.error("Error updating group order:", error)
      const message = error instanceof Error ? error.message : "更新に失敗しました"
      toast.error(message)
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

  const displayOrders = useMemo((): DisplayOrder[] => {
    const groups = new Map<string, (Order & { member?: TableMember })[]>()
    const singles: (Order & { member?: TableMember })[] = []

    for (const order of processedOrders) {
      if (order.shared_group_id) {
        const existing = groups.get(order.shared_group_id) || []
        existing.push(order)
        groups.set(order.shared_group_id, existing)
      } else {
        singles.push(order)
      }
    }

    const result: DisplayOrder[] = []

    // Add grouped orders (use first occurrence position)
    const seen = new Set<string>()
    for (const order of processedOrders) {
      if (order.shared_group_id) {
        if (seen.has(order.shared_group_id)) continue
        seen.add(order.shared_group_id)
        const groupOrders = groups.get(order.shared_group_id)!
        const totalAmount = groupOrders.reduce((sum, o) => sum + o.line_total, 0)
        result.push({
          key: order.shared_group_id,
          orders: groupOrders,
          memberNames: groupOrders.map((o) => o.member?.display_name || "不明"),
          itemName: groupOrders[0]?.item_name || null,
          totalAmount,
          perPerson: Math.floor(totalAmount / groupOrders.length),
          isGrouped: true,
        })
      } else {
        result.push({
          key: order.id,
          orders: [order],
          memberNames: [order.member?.display_name || "不明"],
          itemName: order.item_name,
          totalAmount: order.line_total,
          perPerson: order.line_total,
          isGrouped: false,
        })
      }
    }

    return result
  }, [processedOrders])

  const totalPages = Math.ceil(displayOrders.length / ITEMS_PER_PAGE)
  const paginatedDisplayOrders = displayOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

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
        const json = (await refreshed.json()) as ApiListResponse<ApiTableMember>
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

  const selectedFunTarget = members.find((m) => m.id === funAdjustment.targetMemberId)
  const selectedExemptMember = members.find((m) => m.id === exemptMemberId)
  const roulettePreviewMember = members.find((m) => m.id === roulettePreviewMemberId)
  const funAdjustmentSummary = (() => {
    if (funAdjustment.type === "none" || !selectedFunTarget) return null
    if (funAdjustment.type === "remainder_roulette") {
      return `${selectedFunTarget.display_name} が100円未満の端数を担当`
    }
    if (funAdjustment.type === "lucky_discount") {
      return `${selectedFunTarget.display_name} が500円引き`
    }
    if (funAdjustment.type === "full_burden_roulette") {
      return `${selectedFunTarget.display_name} が全額担当`
    }
    return `${selectedFunTarget.display_name} が500円引き`
  })()

  const funAdjustmentResultLabel = (() => {
    if (funAdjustment.type === "remainder_roulette") return "が100円未満の端数を担当"
    if (funAdjustment.type === "lucky_discount") return "が500円引き"
    if (funAdjustment.type === "organizer_bonus") return "が500円引き"
    if (funAdjustment.type === "full_burden_roulette") return "が全額担当"
    return ""
  })()

  const spinningAdjustmentLabel = (() => {
    if (spinningAdjustmentType === "remainder_roulette") return "端数だけルーレット"
    if (spinningAdjustmentType === "lucky_discount") return "1人だけ500円引き"
    if (spinningAdjustmentType === "full_burden_roulette") return "全額負担ルーレット"
    return ""
  })()

  const exemptionSummary = selectedExemptMember ? `${selectedExemptMember.display_name} は支払い0円` : null
  const settlementAdjustmentSummary = [exemptionSummary, funAdjustmentSummary].filter(Boolean).join(" / ") || null

  // Auto-calculate when settings change
  useEffect(() => {
    if (!settingsLoaded || totals.totalAmount === 0 || members.length < 2) return

    const controller = new AbortController()
    const calculate = async () => {
      try {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ tableId: table.id, payerId, splitMode, memberWeights, exemptMemberId, funAdjustment }),
          signal: controller.signal,
        })

        if (!res.ok) return
        setPaymentRefresh((v) => v + 1)
      } catch {
        // ignore abort errors
      }
    }

    calculate()
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, payerId, splitMode, memberWeights, exemptMemberId, funAdjustment, totals.totalAmount, members.length])

  return (
    <main className="min-h-screen bg-background pb-4">
      <header className="sticky top-0 z-10 border-b border-[var(--wm-line)] bg-background/85 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3.5">
          <Link
            href="/group"
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--wm-ink-3)] transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            グループ一覧
          </Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[18px] font-bold tracking-tight">{table.name}</h1>
                <span
                  className="wm-chip wm-chip-success shrink-0"
                  style={{ padding: "2px 8px", fontSize: 10 }}
                >
                  <span
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ background: "var(--wm-success)" }}
                  />
                  LIVE
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--wm-ink-3)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(table.event_date).toLocaleDateString("ja-JP")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {members.length}人参加
                </span>
                {currentMembership.is_master && (
                  <span className="flex items-center gap-1 text-[var(--wm-accent)]">
                    <Crown className="h-3 w-3" />
                    幹事
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                aria-label="共有"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--wm-line-strong)] bg-card text-[var(--wm-ink-2)] transition hover:bg-[var(--wm-surface)]"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <Button asChild variant="outline" size="sm" className="bg-card">
                <Link href={`/group/table/${table.invite_token}/taxi`}>
                  <Car className="mr-1 h-4 w-4" />
                  代行
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-4 pt-3 space-y-4">
        {/* 黒地の合計カード (デザイン: Group の合計 + 1人あたり + メンバー別進捗バー) */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--wm-ink)", color: "#fff" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">合計</div>
              <div className="wm-num mt-1 text-[30px] font-bold leading-none tracking-tight">
                ¥{totals.totalAmount.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">1人あたり</div>
              <div className="wm-num mt-1 text-[22px] font-bold">
                ¥{members.length > 0 ? Math.ceil(totals.totalAmount / members.length).toLocaleString() : 0}
              </div>
            </div>
          </div>
          {/* メンバー別進捗バー */}
          {totals.totalAmount > 0 && totals.byMember.some((b) => b.amount > 0) ? (
            <div className="mt-3.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.1]">
              {totals.byMember
                .filter((b) => b.amount > 0)
                .map(({ member, amount }) => (
                  <div
                    key={member.id}
                    style={{
                      width: `${(amount / totals.totalAmount) * 100}%`,
                      background: memberColorMap[member.id] || "#9A9892",
                    }}
                  />
                ))}
            </div>
          ) : (
            <div
              className="mt-3.5 h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.1)" }}
              aria-hidden="true"
            />
          )}
          <div className="mt-2.5 flex items-center justify-between text-[11px] opacity-70">
            <span>注文 {orders.length} 件</span>
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3" />
              リアルタイム同期
            </span>
          </div>
        </div>

        {/* メンバー横スクロール */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="wm-h3 text-[14px] font-semibold">メンバー ({members.length}人)</h2>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wm-accent)] hover:opacity-80"
            >
              <Plus className="h-3 w-3" />
              招待
            </button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex gap-2">
              {totals.byMember.map(({ member, amount, count }) => {
                const isYou = member.id === currentMembership.id
                const initial = member.display_name.charAt(0)
                return (
                  <div
                    key={member.id}
                    className="shrink-0"
                    style={{ width: 96 }}
                  >
                    <div
                      className="rounded-[12px] border bg-card p-2.5"
                      style={{
                        borderColor: isYou ? "var(--wm-accent)" : "var(--wm-line)",
                        borderWidth: isYou ? 1.5 : 1,
                      }}
                    >
                      <div className="relative inline-block">
                        <span
                          className="wm-avatar"
                          style={{
                            width: 32,
                            height: 32,
                            fontSize: 13,
                            background: memberColorMap[member.id] || "var(--wm-ink)",
                          }}
                        >
                          {initial}
                        </span>
                        <span
                          className="absolute -right-0.5 -bottom-0.5 h-[9px] w-[9px] rounded-full"
                          style={{
                            background: "var(--wm-success)",
                            border: "2px solid var(--wm-card)",
                          }}
                          aria-label="online"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 truncate text-[12px] font-semibold">
                        <span className="truncate">{member.display_name}</span>
                        {member.is_master && (
                          <Crown className="h-2.5 w-2.5 shrink-0 text-[var(--wm-accent)]" />
                        )}
                      </div>
                      <div className="wm-num mt-0.5 truncate text-[13px] font-bold">
                        ¥{amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[var(--wm-ink-3)]">{count}品</div>
                    </div>
                  </div>
                )
              })}
              {/* ゲスト追加カード */}
              <button
                type="button"
                onClick={() => setShowGuestForm(true)}
                className="shrink-0 rounded-[12px] border border-dashed border-[var(--wm-line-strong)] bg-[var(--wm-surface)]/40 p-2.5 text-left transition hover:bg-[var(--wm-surface)]"
                style={{ width: 96 }}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wm-surface)] text-[var(--wm-ink-3)]">
                  <UserPlus className="h-4 w-4" />
                </span>
                <div className="mt-1.5 text-[12px] font-semibold text-[var(--wm-ink-2)]">ゲスト</div>
                <div className="text-[10px] text-[var(--wm-ink-3)]">名前で追加</div>
              </button>
            </div>
          </div>

          {/* ゲスト追加インライン form */}
          {showGuestForm && (
            <form onSubmit={handleAddGuest} className="mt-2 flex gap-2 rounded-[12px] bg-[var(--wm-surface)] p-2.5">
              <Input
                placeholder="ゲストの名前"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="flex-1 bg-card"
                autoFocus
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
        </section>

        {/* 最近の注文フィード */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="wm-h3 text-[14px] font-semibold">最近の注文</h2>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllOrders(true)}
                className="text-[12px] text-[var(--wm-ink-3)] hover:text-foreground"
              >
                すべて見る ›
              </button>
            )}
          </div>
          {orders.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--wm-line-strong)] bg-[var(--wm-surface)]/40 px-4 py-8 text-center">
              <div className="text-[14px] font-medium">まだ注文がありません</div>
              <div className="mt-1 text-[12px] text-[var(--wm-ink-3)]">
                右下の「+ 注文を追加」から登録できます
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-[var(--wm-line)] bg-card">
              {[...orders]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map((o, i) => {
                  const m = members.find((mm) => mm.id === o.member_id)
                  const initial = m?.display_name.charAt(0) || "?"
                  const ago = (() => {
                    const diff = Date.now() - new Date(o.created_at).getTime()
                    const min = Math.floor(diff / 60000)
                    if (min < 1) return "今"
                    if (min < 60) return `${min}分前`
                    const hr = Math.floor(min / 60)
                    if (hr < 24) return `${hr}時間前`
                    return `${Math.floor(hr / 24)}日前`
                  })()
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center gap-2.5 px-3.5 py-3 ${
                        i ? "border-t border-[var(--wm-line)]" : ""
                      }`}
                    >
                      <span
                        className="wm-avatar shrink-0"
                        style={{
                          width: 28,
                          height: 28,
                          fontSize: 11,
                          background: memberColorMap[o.member_id] || "var(--wm-ink)",
                        }}
                      >
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">
                          {o.item_name || <span className="text-[var(--wm-ink-3)]">(名称なし)</span>}
                        </div>
                        <div className="wm-meta mt-0.5">
                          {m?.display_name || "?"} · {ago}
                        </div>
                      </div>
                      {o.quantity > 1 && (
                        <span className="wm-num text-[12px] text-[var(--wm-ink-3)]">×{o.quantity}</span>
                      )}
                      <span className="wm-num min-w-[60px] text-right text-[14px] font-semibold">
                        ¥{(o.unit_price * o.quantity).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </section>

        {/* 全注文 (詳細表) — 「すべて見る」でポップアップ表示 */}
        <Dialog
          open={showAllOrders}
          onOpenChange={(open) => {
            setShowAllOrders(open)
            if (!open) {
              cancelEdit()
              cancelGroupEdit()
            }
          }}
        >
          <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:w-full">
            <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6 sm:pr-14">
              <DialogTitle>注文一覧</DialogTitle>
              <DialogDescription>
                表示{displayOrders.length}件 / 注文{orders.length}件 / 合計{formatCurrency(totals.totalAmount)}
              </DialogDescription>

              <div className="space-y-2 pt-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={filterMember}
                  onValueChange={(v) => {
                    setFilterMember(v)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-32">
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
              <div className="flex flex-wrap items-center gap-2">
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
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 sm:px-6">
            {paginatedDisplayOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || filterMember !== "__all__" ? "該当する注文はありません" : "注文はありません"}
              </p>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="sm:hidden space-y-2">
                  {paginatedDisplayOrders.map((displayOrder) => {
                    const firstOrder = displayOrder.orders[0]
                    if (!firstOrder) return null
                    return (
                      <div
                        key={displayOrder.key}
                        className="border rounded-lg p-3"
                        style={{ backgroundColor: displayOrder.isGrouped ? undefined : (memberColorMap[firstOrder.member_id] ? `${memberColorMap[firstOrder.member_id]}80` : undefined) }}
                      >
                        {!displayOrder.isGrouped && editingOrderId === firstOrder.id && editForm ? (
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
                                <Button size="sm" onClick={() => saveEdit(firstOrder.id)}>
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : displayOrder.isGrouped && editingGroupId === displayOrder.key && editGroupForm ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {displayOrder.orders.map((o) => (
                                <span
                                  key={o.id}
                                  className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: memberColorMap[o.member_id] || "#e2e8f0" }}
                                >
                                  {o.member?.display_name}
                                </span>
                              ))}
                            </div>
                            <Input
                              placeholder="商品名"
                              value={editGroupForm.item_name}
                              onChange={(e) => setEditGroupForm({ ...editGroupForm, item_name: e.target.value })}
                            />
                            <Input
                              type="number"
                              placeholder="合計金額"
                              min="0"
                              value={editGroupForm.total_amount}
                              onChange={(e) => setEditGroupForm({ ...editGroupForm, total_amount: e.target.value })}
                            />
                            <div className="flex justify-between items-center pt-2">
                              <div>
                                <span className="font-bold">{formatCurrency(Number.parseInt(editGroupForm.total_amount) || 0)}</span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  (1人{formatCurrency(Math.floor((Number.parseInt(editGroupForm.total_amount) || 0) / displayOrder.orders.length))})
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={cancelGroupEdit}>
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={() => saveGroupEdit(displayOrder)}>
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {displayOrder.isGrouped ? (
                                  <div className="flex flex-wrap gap-1">
                                    {displayOrder.orders.map((o) => (
                                      <span
                                        key={o.id}
                                        className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium"
                                        style={{ backgroundColor: memberColorMap[o.member_id] || "#e2e8f0" }}
                                      >
                                        {o.member?.display_name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="font-medium text-sm truncate">{firstOrder.member?.display_name}</span>
                                )}
                                {displayOrder.itemName && (
                                  <span className="text-muted-foreground text-sm truncate">- {displayOrder.itemName}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-bold text-primary">{formatCurrency(displayOrder.totalAmount)}</span>
                                {displayOrder.isGrouped && (
                                  <span className="text-xs text-muted-foreground">(1人{formatCurrency(displayOrder.perPerson)})</span>
                                )}
                                {!displayOrder.isGrouped && firstOrder.quantity > 1 && (
                                  <span className="text-muted-foreground">{formatCurrency(firstOrder.unit_price)} × {firstOrder.quantity}</span>
                                )}
                              </div>
                            </div>
                            {!displayOrder.isGrouped && canManageOrder(firstOrder) && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(firstOrder)}>
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
                                        onClick={() => deleteOrder(firstOrder.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        削除する
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                            {displayOrder.isGrouped && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startGroupEdit(displayOrder)}>
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
                                      <AlertDialogTitle>共有注文を削除しますか？</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {displayOrder.memberNames.join(", ")}の注文({displayOrder.itemName || "商品名なし"})を全て削除します。
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={async () => {
                                          for (const o of displayOrder.orders) {
                                            await deleteOrder(o.id)
                                          }
                                        }}
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
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名前</TableHead>
                        <TableHead>商品名</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDisplayOrders.map((displayOrder) => {
                        const firstOrder = displayOrder.orders[0]
                        if (!firstOrder) return null
                        return (
                          <TableRow key={displayOrder.key}>
                            {!displayOrder.isGrouped && editingOrderId === firstOrder.id && editForm ? (
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
                                <TableCell className="text-right font-medium">
                                  <div className="flex items-center gap-2 justify-end">
                                    <Input
                                      type="number"
                                      className="h-8 w-24 text-right"
                                      min="0"
                                      value={editForm.unit_price}
                                      onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                                    />
                                    <span>×</span>
                                    <Input
                                      type="number"
                                      className="h-8 w-16 text-right"
                                      min="1"
                                      value={editForm.quantity}
                                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(firstOrder.id)}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : displayOrder.isGrouped && editingGroupId === displayOrder.key && editGroupForm ? (
                              <>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {displayOrder.orders.map((o) => (
                                      <span
                                        key={o.id}
                                        className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                                        style={{ backgroundColor: memberColorMap[o.member_id] || "#e2e8f0" }}
                                      >
                                        {o.member?.display_name}
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8"
                                    value={editGroupForm.item_name}
                                    onChange={(e) => setEditGroupForm({ ...editGroupForm, item_name: e.target.value })}
                                  />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <Input
                                    type="number"
                                    className="h-8 w-28 text-right ml-auto"
                                    min="0"
                                    value={editGroupForm.total_amount}
                                    onChange={(e) => setEditGroupForm({ ...editGroupForm, total_amount: e.target.value })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveGroupEdit(displayOrder)}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelGroupEdit}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-medium">
                                  {displayOrder.isGrouped ? (
                                    <div className="flex flex-wrap gap-1">
                                      {displayOrder.orders.map((o) => (
                                        <span
                                          key={o.id}
                                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                                          style={{ backgroundColor: memberColorMap[o.member_id] || "#e2e8f0" }}
                                        >
                                          {o.member?.display_name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span
                                      className="inline-flex px-2 py-1 rounded-md"
                                      style={{ backgroundColor: memberColorMap[firstOrder.member_id] || undefined }}
                                    >
                                      {firstOrder.member?.display_name}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>{displayOrder.itemName || <span className="text-muted-foreground">-</span>}</TableCell>
                                <TableCell className="text-right">
                                  <span className="font-medium">{formatCurrency(displayOrder.totalAmount)}</span>
                                  {displayOrder.isGrouped && (
                                    <span className="text-xs text-muted-foreground ml-1">(1人{formatCurrency(displayOrder.perPerson)})</span>
                                  )}
                                  {!displayOrder.isGrouped && firstOrder.quantity > 1 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({formatCurrency(firstOrder.unit_price)}×{firstOrder.quantity})
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {displayOrder.isGrouped ? (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => startGroupEdit(displayOrder)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>共有注文を削除しますか？</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              {displayOrder.memberNames.join(", ")}の注文を全て削除します。
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={async () => {
                                                for (const o of displayOrder.orders) {
                                                  await deleteOrder(o.id)
                                                }
                                              }}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              削除する
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  ) : canManageOrder(firstOrder) ? (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => startEdit(firstOrder)}
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
                                              onClick={() => deleteOrder(firstOrder.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              削除する
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  ) : null}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        )
                      })}
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
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">割り勘</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">会計する人（レジで払う人）</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger className="h-11 text-base">
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
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">割り方</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode("equal")}
                  className={`flex-1 px-3 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                    splitMode === "equal"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  均等
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("weighted")}
                  className={`flex-1 px-3 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                    splitMode === "weighted"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  金額に差をつける
                </button>
              </div>
            </div>

            {splitMode === "weighted" && (
              <div className="space-y-2">
                {members.map((m) => {
                  const w = memberWeights[m.id] || "normal"
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg"
                      style={{ backgroundColor: memberColorMap[m.id] || undefined }}
                    >
                      <span className="text-sm font-medium truncate flex-shrink min-w-0">{m.display_name}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        {(["less", "normal", "more"] as const).map((tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setMemberWeights((prev) => ({ ...prev, [m.id]: tier }))}
                            className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                              w === tier
                                ? tier === "more" ? "bg-orange-100 border-orange-400 text-orange-700 font-bold"
                                  : tier === "less" ? "bg-blue-100 border-blue-400 text-blue-700 font-bold"
                                  : "bg-white border-primary text-primary font-bold"
                                : "bg-white/80 border-border text-muted-foreground hover:bg-white"
                            }`}
                          >
                            {tier === "more" ? "多め" : tier === "less" ? "少なめ" : "普通"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground">多め×1.5 / 普通×1.0 / 少なめ×0.5</p>
              </div>
            )}

            <div className="rounded-lg border bg-background p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">支払い0円にする人</Label>
                  <Badge variant="outline" className="text-[10px]">任意</Badge>
                </div>
                <Select
                  value={exemptMemberId ?? "__none__"}
                  onValueChange={(value) => setExemptMemberId(value === "__none__" ? null : value)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">指定しない</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  選んだ人の負担額を0円にして、残りのメンバーで再配分します。
                </p>
                {selectedExemptMember && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm font-medium">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: memberColorMap[selectedExemptMember.id] || "var(--wm-surface)" }}
                    >
                      {selectedExemptMember.display_name}
                    </span>
                    <span>は支払い0円</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <button
                type="button"
                onClick={() => setShowFunAdjustments((v) => !v)}
                className="flex w-full flex-col items-stretch gap-2 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Radio className="h-4 w-4 text-primary" />
                  お楽しみ調整
                  <Badge variant="secondary" className="text-[10px]">任意</Badge>
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground sm:text-right">
                  {showFunAdjustments ? "閉じる" : funAdjustmentSummary || "追加する"}
                </span>
              </button>

              {showFunAdjustments && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      type="button"
                      disabled={spinningAdjustmentType !== null || rouletteCandidates.length < 2}
                      onClick={() => runRandomFunAdjustment("remainder_roulette")}
                      className={`rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                        funAdjustment.type === "remainder_roulette" ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <span className="block text-sm font-semibold">端数だけルーレット</span>
                      <span className="mt-1 block text-xs text-muted-foreground">100円未満を1人に寄せる</span>
                    </button>
                    <button
                      type="button"
                      disabled={spinningAdjustmentType !== null || rouletteCandidates.length < 2}
                      onClick={() => runRandomFunAdjustment("lucky_discount")}
                      className={`rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                        funAdjustment.type === "lucky_discount" ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <span className="block text-sm font-semibold">1人だけ500円引き</span>
                      <span className="mt-1 block text-xs text-muted-foreground">ランダムでラッキー割</span>
                    </button>
                    <button
                      type="button"
                      disabled={spinningAdjustmentType !== null || rouletteCandidates.length === 0}
                      onClick={() => runRandomFunAdjustment("full_burden_roulette")}
                      className={`rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                        funAdjustment.type === "full_burden_roulette" ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <span className="block text-sm font-semibold">全額負担ルーレット</span>
                      <span className="mt-1 block text-xs text-muted-foreground">止まった人が全額担当</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        spinningAdjustmentType !== null ||
                        payerId === exemptMemberId ||
                        !rouletteCandidates.some((member) => member.id !== payerId)
                      }
                      onClick={() => setFunAdjustment({ type: "organizer_bonus", targetMemberId: payerId, amount: 500 })}
                      className={`rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${
                        funAdjustment.type === "organizer_bonus" ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <span className="block text-sm font-semibold">会計する人500円引き</span>
                      <span className="mt-1 block text-xs text-muted-foreground">会計する人を少し安く</span>
                    </button>
                  </div>
                  {selectedExemptMember && (
                    <p className="text-xs text-muted-foreground">支払い0円の人はルーレット候補から外れます。</p>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background"
                      disabled={funAdjustment.type === "none" || spinningAdjustmentType !== null}
                      onClick={() => setFunAdjustment({ type: "none" })}
                    >
                      <X className="mr-1 h-4 w-4" />
                      解除
                    </Button>
                  </div>

                  {spinningAdjustmentType && rouletteMembers.length > 0 && (
                    <div className="wm-roulette-stage space-y-3 rounded-lg p-3" aria-live="polite">
                      <div className="relative z-10 flex items-center justify-between gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                          <Sparkles className="h-4 w-4 text-[#F2C14E]" />
                          {spinningAdjustmentLabel}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {roulettePreviewMember && (
                            <span className="hidden max-w-[8rem] truncate rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white/80 sm:inline-flex">
                              {roulettePreviewMember.display_name}
                            </span>
                          )}
                          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white/80">
                            抽選中
                          </span>
                        </div>
                      </div>
                      <div className="wm-roulette-window relative z-10 overflow-hidden rounded-lg py-8">
                        <div className="wm-roulette-marker pointer-events-none absolute bottom-1 left-1/2 z-30 -translate-x-1/2 text-[24px] leading-none">
                          ▲
                        </div>
                        <div className="pointer-events-none absolute inset-y-3 left-1/2 z-20 w-[3px] -translate-x-1/2 rounded-full bg-[#F2C14E]" />
                        <div
                          className="flex will-change-transform"
                          style={{ transform: `translateX(calc(50% - ${rouletteOffset}px))` }}
                        >
                          {rouletteMembers.map((member, index) => {
                            const isPreview = roulettePreviewSlotIndex === index
                            return (
                              <span
                                key={`${member.id}-${index}`}
                                className={`wm-roulette-item mx-1 flex h-14 w-[120px] shrink-0 items-center justify-center truncate rounded-full border px-3 text-center text-xs font-black shadow-sm transition-transform duration-75 ${
                                  isPreview ? "is-active border-[#F2C14E] text-foreground" : "border-white/30 text-foreground"
                                }`}
                                style={{ backgroundColor: memberColorMap[member.id] || "var(--wm-card)" }}
                              >
                                {member.display_name}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {!spinningAdjustmentType && funAdjustmentSummary && (
                    <div className="wm-roulette-result relative flex flex-col gap-2 overflow-hidden rounded-lg bg-background px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      {rouletteConfettiBurst && (
                        <div className="wm-roulette-confetti" aria-hidden="true">
                          {Array.from({ length: 22 }).map((_, index) => (
                            <span
                              key={index}
                              style={{
                                left: `${4 + ((index * 17) % 92)}%`,
                                animationDelay: `${(index % 7) * 0.06}s`,
                                backgroundColor: ["#F2C14E", "#E56B4D", "#78A161", "#6F8AAA"][index % 4],
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <span className="relative z-10 flex min-w-0 flex-wrap items-center gap-1.5 font-medium">
                        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                        {selectedFunTarget && (
                          <span
                            className="max-w-full rounded-full px-2.5 py-1 text-xs font-black text-foreground sm:max-w-[9rem] sm:truncate"
                            style={{ backgroundColor: memberColorMap[selectedFunTarget.id] || "var(--wm-surface)" }}
                          >
                            {selectedFunTarget.display_name}
                          </span>
                        )}
                        <span className="min-w-0 leading-relaxed">{funAdjustmentResultLabel}</span>
                      </span>
                      {(funAdjustment.type === "remainder_roulette" ||
                        funAdjustment.type === "lucky_discount" ||
                        funAdjustment.type === "full_burden_roulette") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="relative z-10 h-8 shrink-0"
                          onClick={() => {
                            if (
                              funAdjustment.type === "remainder_roulette" ||
                              funAdjustment.type === "lucky_discount" ||
                              funAdjustment.type === "full_burden_roulette"
                            ) {
                              runRandomFunAdjustment(funAdjustment.type)
                            }
                          }}
                        >
                          やり直す
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <PaymentTracker
          tableId={table.id}
          tableName={table.name}
          eventDate={table.event_date}
          refreshTrigger={paymentRefresh}
          currentMemberId={currentMembership.id}
          memberColorMap={memberColorMap}
          members={members}
          orders={orders}
          adjustmentSummary={settlementAdjustmentSummary}
        />
      </div>

      {/* フローティング「+ 注文を追加」CTA */}
      <button
        type="button"
        onClick={() => setAddOrderOpen(true)}
        aria-label="注文を追加"
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-50 inline-flex items-center gap-1.5 rounded-full bg-[var(--wm-accent)] px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[var(--wm-accent-pressed)] active:scale-95 md:bottom-6"
        style={{ boxShadow: "0 8px 22px rgba(200, 85, 61, 0.32)" }}
      >
        <Plus className="h-4 w-4" />
        注文を追加
      </button>

      {/* 注文追加 Dialog */}
      <Dialog open={addOrderOpen} onOpenChange={setAddOrderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>注文を追加</DialogTitle>
            <DialogDescription>メンバー・商品名・金額を入力</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              handleAddOrder(e)
              if (unitPrice) setAddOrderOpen(false)
            }}
            className="space-y-3"
          >
            <div>
              <Label className="text-sm">メンバーを選択 *</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const isSelected = selectedMembers.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-[var(--wm-line-strong)] bg-card text-[var(--wm-ink-2)] hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setSelectedMembers((prev) =>
                          isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                        )
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {m.display_name}
                      {m.is_guest && " (ゲスト)"}
                    </button>
                  )
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 text-xs"
                onClick={() => setSelectedMembers(members.map((m) => m.id))}
              >
                全員選択
              </Button>
              {selectedMembers.length > 1 && unitPrice && (
                <p className="mt-1 text-xs text-muted-foreground">
                  1人あたり: {formatCurrency(Math.floor((Number.parseInt(unitPrice, 10) * (Number.parseInt(quantity, 10) || 1)) / selectedMembers.length))}
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm">商品名（任意）</Label>
              <Input
                placeholder="例: ビール"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">金額 *</Label>
                <Input
                  type="number"
                  placeholder="500"
                  required
                  min="0"
                  inputMode="numeric"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm">数量</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <Plus className="mr-1 h-4 w-4" />
              追加
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 招待 Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>メンバーを招待</DialogTitle>
            <DialogDescription>リンク・QR・SNS で共有できます</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">招待リンク</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/group/join/${table.invite_token}`}
                  readOnly
                  className="text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink} title="コピー" className="bg-card">
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-2 flex gap-2">
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

            {isTableOwner && table.invite_password && (
              <div className="flex items-center justify-between border-t border-[var(--wm-line)] pt-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">パスワード:</span>
                  <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold">
                    {table.invite_password}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(table.invite_password!)
                    toast.success("パスワードをコピーしました")
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  コピー
                </Button>
              </div>
            )}

            {isTableOwner && (
              <div className="flex items-center justify-between border-t border-[var(--wm-line)] pt-3">
                <div className="flex items-center gap-2">
                  {isEffectivelyLocked ? (
                    <Lock className="h-4 w-4 text-amber-600" />
                  ) : (
                    <LockOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {isEffectivelyLocked ? (
                      <span className="text-amber-600">締め切り中</span>
                    ) : (
                      <span className="text-muted-foreground">参加受付中</span>
                    )}
                  </span>
                </div>
                <Button
                  variant={isEffectivelyLocked ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleLock}
                  disabled={isTogglingLock}
                  className={isEffectivelyLocked ? "" : "bg-card"}
                >
                  {isEffectivelyLocked ? "再開" : "締め切る"}
                </Button>
              </div>
            )}

            {/* メンバー一覧 (削除可能) */}
            <div className="border-t border-[var(--wm-line)] pt-3">
              <div className="mb-2 text-sm font-semibold">参加メンバー</div>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <Badge
                    key={member.id}
                    variant={member.id === currentMembership.id ? "default" : "secondary"}
                    className="group flex items-center gap-1 text-black"
                    style={{
                      backgroundColor: memberColorMap[member.id] || undefined,
                      border: member.is_guest
                        ? "1px dashed #888"
                        : member.id === currentMembership.id
                          ? "2px solid var(--wm-accent)"
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
                            className="ml-1 hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{member.display_name}を削除しますか？</AlertDialogTitle>
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
