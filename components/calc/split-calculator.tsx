"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Minus, Plus, Copy, Check } from "lucide-react"
import { toast } from "sonner"

const PERSON_MIN = 1
const PERSON_MAX = 99
const AMOUNT_MAX = 99_999_999

type RoundMode = "none" | "ceil100" | "ceil500" | "ceil1000"

function clampPersonCount(n: number) {
  if (!Number.isFinite(n)) return PERSON_MIN
  return Math.min(PERSON_MAX, Math.max(PERSON_MIN, Math.floor(n)))
}

function PersonStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-[14px] border border-[var(--wm-line)] bg-card">
      <button
        type="button"
        onClick={() => onChange(clampPersonCount(value - 1))}
        disabled={value <= PERSON_MIN}
        className="inline-flex h-12 w-12 items-center justify-center text-[var(--wm-ink-2)] transition active:bg-[var(--wm-surface)] disabled:opacity-30"
        aria-label="減らす"
      >
        <Minus className="h-5 w-5" />
      </button>
      <div className="flex min-w-[80px] items-center justify-center border-x border-[var(--wm-line)] px-3">
        <span className="wm-num text-[22px] font-bold tabular-nums leading-none">{value}</span>
        <span className="ml-0.5 text-[12px] text-[var(--wm-ink-3)]">人</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(clampPersonCount(value + 1))}
        disabled={value >= PERSON_MAX}
        className="inline-flex h-12 w-12 items-center justify-center text-[var(--wm-ink-2)] transition active:bg-[var(--wm-surface)] disabled:opacity-30"
        aria-label="増やす"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}

const ROUND_OPTIONS: { value: RoundMode; label: string; description: string }[] = [
  { value: "none", label: "1円単位", description: "そのまま" },
  { value: "ceil100", label: "100円", description: "1人あたり100円単位で切り上げ" },
  { value: "ceil500", label: "500円", description: "1人あたり500円単位で切り上げ" },
  { value: "ceil1000", label: "1000円", description: "1人あたり1000円単位で切り上げ" },
]

export function SplitCalculator() {
  const [amount, setAmount] = useState("")
  const [personCount, setPersonCount] = useState(2)
  const [roundMode, setRoundMode] = useState<RoundMode>("none")
  const [copied, setCopied] = useState(false)

  const total = Number.parseInt(amount, 10)
  const validTotal = Number.isFinite(total) && total > 0
  const persons = clampPersonCount(personCount)

  const result = useMemo(() => {
    if (!validTotal) return null
    if (roundMode === "none") {
      const per = Math.floor(total / persons)
      const remainder = total - per * persons
      return {
        kind: "exact" as const,
        per,
        remainder,
        majorityPay: per,
        majorityCount: persons - remainder,
        minorityPay: per + 1,
        minorityCount: remainder,
        collected: total,
        surplus: 0,
      }
    }
    const step = roundMode === "ceil100" ? 100 : roundMode === "ceil500" ? 500 : 1000
    const baseRound = Math.ceil(total / persons / step) * step
    const collected = baseRound * persons
    const surplus = collected - total
    return {
      kind: "rounded" as const,
      per: baseRound,
      remainder: 0,
      majorityPay: baseRound,
      majorityCount: persons,
      minorityPay: baseRound,
      minorityCount: 0,
      collected,
      surplus,
    }
  }, [validTotal, total, persons, roundMode])

  const handleCopy = async () => {
    if (!result) return
    const lines = [
      `合計 ¥${total.toLocaleString()} を ${persons} 人で割り勘`,
      result.kind === "exact"
        ? result.remainder === 0
          ? `1人あたり ¥${result.per.toLocaleString()}`
          : `${result.majorityCount}名 ¥${result.majorityPay.toLocaleString()} / ${result.minorityCount}名 ¥${result.minorityPay.toLocaleString()}`
        : `1人あたり ¥${result.per.toLocaleString()} (徴収 ¥${result.collected.toLocaleString()} / おつり ¥${result.surplus.toLocaleString()})`,
    ].join("\n")
    try {
      await navigator.clipboard.writeText(lines)
      setCopied(true)
      toast.success("結果をコピーしました")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("コピーに失敗しました")
    }
  }

  return (
    <div className="space-y-3">
      {/* 金額・人数入力 */}
      <div className="wm-card p-4 space-y-4">
        <div>
          <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">合計金額</Label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] font-semibold text-[var(--wm-ink-3)]">¥</span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              max={AMOUNT_MAX}
              placeholder="例: 12800"
              className="wm-num h-14 pl-10 pr-4 text-right text-[26px] font-bold placeholder:text-[var(--wm-ink-4)] placeholder:font-normal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "")
                if (v === "") return setAmount("")
                const n = Number.parseInt(v, 10)
                if (n > AMOUNT_MAX) return
                setAmount(String(n))
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">人数</Label>
          <PersonStepper value={persons} onChange={setPersonCount} />
        </div>
      </div>

      {/* 丸めオプション */}
      <div className="wm-card p-3">
        <Label className="text-[11px] font-semibold tracking-wider text-[var(--wm-ink-3)]">
          1人あたりの単位
        </Label>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {ROUND_OPTIONS.map((opt) => {
            const active = roundMode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRoundMode(opt.value)}
                className={`rounded-[10px] py-2 text-[12px] font-semibold transition ${
                  active
                    ? "bg-[var(--wm-accent)] text-white"
                    : "bg-[var(--wm-surface)] text-[var(--wm-ink-2)] hover:bg-[var(--wm-surface)]/80"
                }`}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--wm-ink-3)]">
          {ROUND_OPTIONS.find((o) => o.value === roundMode)?.description}
        </p>
      </div>

      {/* 結果カード */}
      {result && (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--wm-ink)", color: "#fff" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">1人あたり</div>
                <div className="wm-num mt-1 text-[36px] font-bold leading-none tracking-tight">
                  ¥{result.per.toLocaleString()}
                  {result.kind === "exact" && result.remainder > 0 && (
                    <span className="ml-2 text-[14px] font-semibold opacity-70">
                      〜¥{(result.per + 1).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold transition hover:bg-white/[0.14] active:scale-95"
                aria-label="結果をコピー"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "コピー済み" : "コピー"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.1] pt-3 text-[11.5px] opacity-80">
              <span>
                合計 <span className="wm-num font-bold">¥{total.toLocaleString()}</span>
              </span>
              <span>
                <span className="wm-num font-bold">{persons}</span> 人で割り勘
              </span>
            </div>
          </div>

          {/* 内訳カード */}
          {result.kind === "exact" && result.remainder > 0 && (
            <div className="wm-card p-4 space-y-2">
              <div className="text-[11px] font-bold tracking-wider text-[var(--wm-ink-3)]">
                端数の内訳
              </div>
              <div className="flex items-center justify-between rounded-[10px] bg-[var(--wm-surface)] px-3 py-2.5">
                <span className="text-[13px] font-medium">
                  {result.majorityCount} 名
                </span>
                <span className="wm-num text-[16px] font-bold text-foreground">
                  ¥{result.majorityPay.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] bg-[var(--wm-accent-soft)] px-3 py-2.5">
                <span className="text-[13px] font-medium text-[var(--wm-accent-pressed)]">
                  {result.minorityCount} 名 (端数 +1円)
                </span>
                <span className="wm-num text-[16px] font-bold text-[var(--wm-accent-pressed)]">
                  ¥{result.minorityPay.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {result.kind === "rounded" && result.surplus > 0 && (
            <div className="wm-card p-4">
              <div className="text-[11px] font-bold tracking-wider text-[var(--wm-ink-3)]">
                徴収・おつり
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-[10px] bg-[var(--wm-surface)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--wm-ink-3)]">徴収合計</div>
                  <div className="wm-num text-[16px] font-bold">
                    ¥{result.collected.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-[10px] bg-[var(--wm-accent-soft)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--wm-accent-pressed)]">幹事に残る</div>
                  <div className="wm-num text-[16px] font-bold text-[var(--wm-accent-pressed)]">
                    +¥{result.surplus.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!result && (
        <div className="rounded-[14px] border border-dashed border-[var(--wm-line-strong)] bg-[var(--wm-surface)]/40 px-4 py-8 text-center">
          <div className="text-[13.5px] font-medium text-[var(--wm-ink-2)]">
            合計金額を入力してください
          </div>
          <div className="mt-1 text-[12px] text-[var(--wm-ink-3)]">
            人数と単位を選ぶと、1人あたりの金額がすぐに表示されます
          </div>
        </div>
      )}
    </div>
  )
}
