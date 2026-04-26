"use client"

import { useState, useEffect, useCallback } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { getGuestToken } from "@/lib/guest/guest-session"
import { SettlementShareButton } from "./settlement-share-button"

interface PaymentData {
  id: string
  fromMemberId: string
  toMemberId: string
  fromName: string
  toName: string
  amount: number
  isPaid: boolean
  paidAt: string | null
}

interface PaymentTrackerProps {
  tableId: string
  tableName: string
  refreshTrigger?: number
  currentMemberId: string
  memberColorMap?: Record<string, string>
}

export function PaymentTracker({ tableId, tableName, refreshTrigger, currentMemberId, memberColorMap = {} }: PaymentTrackerProps) {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [memberAmounts, setMemberAmounts] = useState<Record<string, number>>({})
  const [totalAmount, setTotalAmount] = useState(0)
  const [payerId, setPayerId] = useState<string | null>(null)
  const [payerName, setPayerName] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const getApiHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    const guestToken = getGuestToken()
    if (guestToken) {
      headers["X-Guest-Token"] = guestToken
    }
    return headers
  }

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments?tableId=${tableId}`, { headers: getApiHeaders() })
      if (res.ok) {
        const json = await res.json()
        setPayments(json.data || [])
        setMemberAmounts(json.memberAmounts || {})
        setTotalAmount(json.totalAmount || 0)
        setPayerId(json.payerId || null)
        setPayerName(json.payerName || null)
        setMemberCount(json.memberCount || 0)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments, refreshTrigger])

  const togglePaid = async (paymentId: string, isPaid: boolean) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({ isPaid }),
      })

      if (!res.ok) {
        throw new Error("更新に失敗しました")
      }

      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId ? { ...p, isPaid, paidAt: isPaid ? new Date().toISOString() : null } : p
        )
      )
      toast.success(isPaid ? "支払い済み" : "未払いに戻しました")
    } catch {
      toast.error("更新に失敗しました")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (payments.length === 0 || !payerId) {
    return null
  }

  // Share button entries
  const shareEntries = payments.map((p) => ({
    memberName: p.fromName,
    amount: p.amount,
    isPaid: p.isPaid,
  }))

  // Build full member list: payer + all from members
  const allMemberEntries: { id: string; name: string; amount: number; isPayer: boolean; payment?: PaymentData }[] = []

  // Add payer first
  allMemberEntries.push({
    id: payerId,
    name: payerName || "不明",
    amount: memberAmounts[payerId] || 0,
    isPayer: true,
  })

  // Add other members
  for (const p of payments) {
    allMemberEntries.push({
      id: p.fromMemberId,
      name: p.fromName,
      amount: p.amount,
      isPayer: false,
      payment: p,
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>支払い</span>
          <SettlementShareButton tableName={tableName} perPerson={memberAmounts[currentMemberId] || 0} entries={shareEntries} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {allMemberEntries.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              entry.isPayer ? "border-2 border-primary/50" : "border"
            } ${entry.payment?.isPaid ? "opacity-60" : ""}`}
            style={{
              backgroundColor: entry.payment?.isPaid
                ? "#f0fdf4"
                : memberColorMap[entry.id] || "#f8fafc",
            }}
          >
            {entry.isPayer ? (
              <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <Checkbox
                checked={entry.payment?.isPaid || false}
                onCheckedChange={(checked) => entry.payment && togglePaid(entry.payment.id, !!checked)}
              />
            )}
            <span className={`flex-1 text-sm font-medium ${entry.payment?.isPaid ? "line-through text-muted-foreground" : ""}`}>
              {entry.name}
              {entry.id === currentMemberId && " (あなた)"}
            </span>
            <span className={`font-bold text-sm ${entry.isPayer ? "text-primary" : entry.payment?.isPaid ? "text-muted-foreground" : ""}`}>
              {formatCurrency(entry.amount)}
            </span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-1">
          合計 {formatCurrency(totalAmount)} / {memberCount}人
        </p>
      </CardContent>
    </Card>
  )
}
