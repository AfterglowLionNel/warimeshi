export interface SettlementEntry {
  memberName: string
  amount: number
  isPaid: boolean
}

export interface SettlementBreakdownItem {
  itemName: string
  quantity: number
  amount: number
}

export interface SettlementBreakdownMember {
  memberName: string
  totalAmount: number
  items: SettlementBreakdownItem[]
}

export interface SettlementMemberSummary {
  memberName: string
  amount: number
  isPayer: boolean
}

interface SettlementFormatOptions {
  totalAmount?: number
  eventDate?: string | null
  payerName?: string | null
  adjustmentSummary?: string | null
  memberSummaries?: SettlementMemberSummary[]
  breakdowns?: SettlementBreakdownMember[]
}

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`
}

export function formatEventDate(value?: string | null) {
  if (!value) return null

  const normalized = value.split("T")[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date)
}

export function formatSettlement(
  tableName: string,
  perPerson: number,
  entries: SettlementEntry[],
  options: SettlementFormatOptions = {},
): string {
  const lines: string[] = []
  const eventDate = formatEventDate(options.eventDate)

  lines.push(`【${tableName}】割り勘結果`)
  if (eventDate) {
    lines.push(`日付: ${eventDate}`)
  }
  if (options.totalAmount !== undefined) {
    lines.push(`合計: ${formatYen(options.totalAmount)}`)
  } else {
    lines.push(`1人あたり: ${formatYen(perPerson)}`)
  }
  if (options.payerName) {
    lines.push(`会計する人: ${options.payerName}`)
  }
  lines.push("")

  if (options.memberSummaries?.length) {
    lines.push("各自の金額")
    for (const member of options.memberSummaries) {
      const suffix = member.isPayer ? "（会計する人）" : ""
      lines.push(`・${member.memberName}${suffix}: ${formatYen(member.amount)}`)
    }
    lines.push("")
  }

  lines.push("支払い")
  if (entries.length === 0) {
    lines.push("支払いなし")
  } else {
    for (const entry of entries) {
      const status = entry.isPaid ? "✓" : "☐"
      const toPayer = options.payerName ? ` → ${options.payerName}` : ""
      lines.push(`${status} ${entry.memberName}${toPayer}: ${formatYen(entry.amount)}`)
    }
  }

  if (options.adjustmentSummary) {
    lines.push("")
    lines.push("調整")
    lines.push(`・${options.adjustmentSummary}`)
  }

  if (options.breakdowns?.length) {
    lines.push("")
    lines.push("食べた内訳")
    for (const member of options.breakdowns) {
      lines.push("")
      lines.push(`${member.memberName} 小計 ${formatYen(member.totalAmount)}`)
      if (member.items.length === 0) {
        lines.push("・注文なし")
      } else {
        for (const item of member.items) {
          const quantity = item.quantity > 1 ? ` x${item.quantity}` : ""
          lines.push(`・${item.itemName}${quantity} ${formatYen(item.amount)}`)
        }
      }
    }
  }

  lines.push("")
  lines.push("warimeshiで計算しました")

  return lines.join("\n")
}
