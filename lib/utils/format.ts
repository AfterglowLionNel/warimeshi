// Currency formatting utilities
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "¥0"
  return `¥${amount.toLocaleString("ja-JP")}`
}

export function parseCurrency(value: string): number {
  return Number.parseInt(value.replace(/[¥,]/g, ""), 10) || 0
}

// 招待トークン生成は @/lib/utils/invite-token (server-only) に移動。
