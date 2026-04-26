export interface SettlementEntry {
  memberName: string
  amount: number
  isPaid: boolean
}

export function formatSettlement(tableName: string, perPerson: number, entries: SettlementEntry[]): string {
  const lines: string[] = []
  lines.push(`【${tableName}】割り勘`)
  lines.push(`1人あたり: ¥${perPerson.toLocaleString()}`)
  lines.push("")

  for (const entry of entries) {
    const status = entry.isPaid ? "✓" : "☐"
    lines.push(`${status} ${entry.memberName}: ¥${entry.amount.toLocaleString()}`)
  }

  lines.push("")
  lines.push("warimeshiで計算しました")

  return lines.join("\n")
}
