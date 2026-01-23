// Currency formatting utilities
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "¥0"
  return `¥${amount.toLocaleString("ja-JP")}`
}

export function parseCurrency(value: string): number {
  return Number.parseInt(value.replace(/[¥,]/g, ""), 10) || 0
}

// Generate random token for invite links
export function generateInviteToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let token = ""
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
