import { Radio } from "lucide-react"

const members = [
  { name: "たろう", items: 4, amount: 4810, color: "#C8553D" },
  { name: "はなこ", items: 3, amount: 3920, color: "#3F6B4E" },
  { name: "けんじ", items: 5, amount: 5210, color: "#3D5C7C" },
  { name: "みき", items: 4, amount: 4700, color: "#A47B3D" },
] as const

const total = members.reduce((sum, m) => sum + m.amount, 0)

export function PreviewCard() {
  return (
    <div className="wm-card p-5">
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <div className="text-xs font-semibold text-[var(--wm-ink-3)]">金曜の飲み会</div>
          <div className="mt-0.5 text-lg font-bold">
            合計 <span className="wm-num">¥{total.toLocaleString()}</span>
          </div>
        </div>
        <span className="wm-chip wm-chip-success">
          <Radio className="h-3 w-3" />
          同期中
        </span>
      </div>
      {members.map((m, i) => (
        <div
          key={m.name}
          className={`flex items-center gap-2.5 py-2 ${i ? "border-t border-[var(--wm-line)]" : ""}`}
        >
          <span
            className="wm-avatar"
            style={{ width: 28, height: 28, fontSize: 11, background: m.color }}
          >
            {m.name[0]}
          </span>
          <span className="flex-1 text-sm font-medium">{m.name}</span>
          <span className="text-[11px] text-[var(--wm-ink-3)]">{m.items}品</span>
          <span className="wm-num min-w-[64px] text-right text-sm font-semibold">
            ¥{m.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
