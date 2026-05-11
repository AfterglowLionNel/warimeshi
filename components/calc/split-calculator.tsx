"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Copy, Check, Sparkles, Radio, X, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import {
  useFunAdjustmentRoulette,
  type RouletteResult,
} from "@/components/group/use-fun-adjustment-roulette"

const PERSON_MIN = 1
const PERSON_MAX = 30
const AMOUNT_MAX = 99_999_999

type SplitMode = "equal" | "weighted"
type WeightTier = "less" | "normal" | "more"

const WEIGHT_MULTIPLIERS: Record<WeightTier, number> = {
  less: 0.5,
  normal: 1.0,
  more: 1.5,
}

type FunAdjustment =
  | { type: "none" }
  | { type: "remainder_roulette"; targetId: string }
  | { type: "lucky_discount"; targetId: string; amount: number }
  | { type: "full_burden_roulette"; targetId: string }

type Person = { id: string; name: string }

const MEMBER_COLORS = [
  "#FFE5D9",
  "#E2F0CB",
  "#CDE7F0",
  "#FFD1DC",
  "#FFF3B0",
  "#E0CDF0",
  "#D4F0E1",
  "#FFE0B5",
] as const

function clampPersonCount(n: number) {
  if (!Number.isFinite(n)) return PERSON_MIN
  return Math.min(PERSON_MAX, Math.max(PERSON_MIN, Math.floor(n)))
}

function distributeAmount(
  amounts: Record<string, number>,
  ids: string[],
  amount: number,
) {
  if (amount <= 0 || ids.length === 0) return
  const base = Math.floor(amount / ids.length)
  let remainder = amount - base * ids.length
  for (const id of ids) {
    amounts[id] = (amounts[id] || 0) + base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
  }
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

let _personIdSeq = 0
function makePerson(): Person {
  _personIdSeq += 1
  return { id: `p-${Date.now()}-${_personIdSeq}`, name: "" }
}

export function SplitCalculator() {
  const [amount, setAmount] = useState("")
  const [persons, setPersons] = useState<Person[]>(() => [makePerson(), makePerson()])
  const [showNamesEditor, setShowNamesEditor] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>("equal")
  const [weights, setWeights] = useState<Record<string, WeightTier>>({})
  const [funAdjustment, setFunAdjustment] = useState<FunAdjustment>({ type: "none" })
  const [showFun, setShowFun] = useState(false)
  const [copied, setCopied] = useState(false)

  const personCount = persons.length

  const displayNameFor = useCallback(
    (p: Person, idx: number) => p.name.trim() || `${idx + 1}人目`,
    [],
  )

  const setPersonCount = (next: number) => {
    const target = clampPersonCount(next)
    setPersons((prev) => {
      if (target === prev.length) return prev
      if (target > prev.length) {
        const adding = Array.from({ length: target - prev.length }, () => makePerson())
        return [...prev, ...adding]
      }
      return prev.slice(0, target)
    })
  }

  // ターゲットが存在しなくなったら funAdjustment を解除
  useEffect(() => {
    if (funAdjustment.type === "none") return
    if (!persons.some((p) => p.id === funAdjustment.targetId)) {
      setFunAdjustment({ type: "none" })
    }
  }, [persons, funAdjustment])

  // 削除された人の weights もクリーンアップ
  useEffect(() => {
    setWeights((prev) => {
      const ids = new Set(persons.map((p) => p.id))
      let changed = false
      const next: Record<string, WeightTier> = {}
      for (const [id, w] of Object.entries(prev)) {
        if (ids.has(id)) next[id] = w
        else changed = true
      }
      return changed ? next : prev
    })
  }, [persons])

  // 「金額に差をつける」が ON のときは名前編集を自動展開 (操作対象が見えるように)
  useEffect(() => {
    if (splitMode === "weighted") setShowNamesEditor(true)
  }, [splitMode])

  const memberColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    persons.forEach((p, i) => {
      map[p.id] = MEMBER_COLORS[i % MEMBER_COLORS.length]
    })
    return map
  }, [persons])

  // useFunAdjustmentRoulette は { id, display_name } さえあれば動く
  const virtualMembers = useMemo(
    () => persons.map((p, i) => ({ id: p.id, display_name: displayNameFor(p, i) })),
    [persons, displayNameFor],
  )

  const handleRouletteResult = useCallback((result: RouletteResult) => {
    if (result.type === "lucky_discount") {
      setFunAdjustment({ type: "lucky_discount", targetId: result.targetMemberId, amount: result.amount || 500 })
    } else if (result.type === "remainder_roulette") {
      setFunAdjustment({ type: "remainder_roulette", targetId: result.targetMemberId })
    } else if (result.type === "full_burden_roulette") {
      setFunAdjustment({ type: "full_burden_roulette", targetId: result.targetMemberId })
    }
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
    members: virtualMembers,
    exemptMemberId: null,
    onResult: handleRouletteResult,
  })

  const total = Number.parseInt(amount, 10)
  const validTotal = Number.isFinite(total) && total > 0

  const result = useMemo(() => {
    if (!validTotal) return null
    const memberIds = persons.map((p) => p.id)
    if (memberIds.length === 0) return null

    const amounts: Record<string, number> = {}
    memberIds.forEach((id) => (amounts[id] = 0))

    // 1) 初期割り当て
    if (splitMode === "weighted") {
      // 多め=1.5 / 普通=1.0 / 少なめ=0.5 の比率で配分
      const tiers = memberIds.map((id) => weights[id] || "normal")
      const totalWeight = tiers.reduce((sum, t) => sum + WEIGHT_MULTIPLIERS[t], 0)
      if (totalWeight <= 0) {
        // 全員少なめ&0 等の異常系: 均等にフォールバック
        distributeAmount(amounts, memberIds, total)
      } else {
        const raw = memberIds.map((id, i) => ({
          id,
          index: i,
          rawAmount: (total * WEIGHT_MULTIPLIERS[tiers[i]]) / totalWeight,
        }))
        let assigned = 0
        for (const r of raw) {
          const v = Math.floor(r.rawAmount)
          amounts[r.id] = v
          assigned += v
        }
        // 端数を小数部の大きい順に +1 円ずつ配る
        let remainder = total - assigned
        const order = [...raw].sort((a, b) => {
          const fa = a.rawAmount - Math.floor(a.rawAmount)
          const fb = b.rawAmount - Math.floor(b.rawAmount)
          return fb - fa || a.index - b.index
        })
        for (const r of order) {
          if (remainder <= 0) break
          amounts[r.id] += 1
          remainder -= 1
        }
      }
    } else {
      distributeAmount(amounts, memberIds, total)
    }

    // 2) お楽しみ調整
    if (funAdjustment.type === "full_burden_roulette") {
      const burdenTotal = memberIds.reduce((sum, id) => sum + (amounts[id] || 0), 0)
      memberIds.forEach((id) => {
        amounts[id] = id === funAdjustment.targetId ? burdenTotal : 0
      })
    } else if (funAdjustment.type === "remainder_roulette") {
      const unit = 100
      let carried = 0
      for (const id of memberIds) {
        if (id === funAdjustment.targetId) continue
        const current = amounts[id] || 0
        const rounded = Math.floor(current / unit) * unit
        amounts[id] = rounded
        carried += current - rounded
      }
      amounts[funAdjustment.targetId] = (amounts[funAdjustment.targetId] || 0) + carried
    } else if (funAdjustment.type === "lucky_discount") {
      const want = funAdjustment.amount
      const current = amounts[funAdjustment.targetId] || 0
      const discount = Math.min(want, Math.max(0, current))
      if (discount > 0) {
        amounts[funAdjustment.targetId] = current - discount
        const recipients = memberIds.filter((id) => id !== funAdjustment.targetId)
        distributeAmount(amounts, recipients, discount)
      }
    }

    const collected = memberIds.reduce((sum, id) => sum + (amounts[id] || 0), 0)
    return { amounts, collected }
  }, [validTotal, total, persons, funAdjustment, splitMode, weights])

  const breakdown = useMemo(() => {
    if (!result) return null
    return persons.map((p, i) => ({
      ...p,
      displayName: displayNameFor(p, i),
      amount: result.amounts[p.id] || 0,
      isTarget: funAdjustment.type !== "none" && (funAdjustment as { targetId?: string }).targetId === p.id,
    }))
  }, [result, persons, funAdjustment, displayNameFor])

  const targetPerson = useMemo(() => {
    if (funAdjustment.type === "none") return null
    return persons.find((p) => p.id === (funAdjustment as { targetId: string }).targetId) || null
  }, [funAdjustment, persons])

  const funSummary = useMemo(() => {
    if (funAdjustment.type === "none" || !targetPerson) return null
    const name = displayNameFor(
      targetPerson,
      persons.findIndex((p) => p.id === targetPerson.id),
    )
    if (funAdjustment.type === "remainder_roulette") return `${name} が100円未満の端数を担当`
    if (funAdjustment.type === "lucky_discount") return `${name} が500円引き`
    return `${name} が全額担当`
  }, [funAdjustment, targetPerson, displayNameFor, persons])

  const spinningLabel =
    spinningAdjustmentType === "remainder_roulette"
      ? "端数だけルーレット"
      : spinningAdjustmentType === "lucky_discount"
      ? "1人だけ500円引き"
      : spinningAdjustmentType === "full_burden_roulette"
      ? "全額負担ルーレット"
      : ""

  const resultLabel =
    funAdjustment.type === "remainder_roulette"
      ? "が100円未満の端数を担当"
      : funAdjustment.type === "lucky_discount"
      ? "が500円引き"
      : funAdjustment.type === "full_burden_roulette"
      ? "が全額担当"
      : ""

  const roulettePreview = roulettePreviewMemberId
    ? virtualMembers.find((m) => m.id === roulettePreviewMemberId)
    : null

  const handleCopy = async () => {
    if (!result || !breakdown) return
    const hasCustom = persons.some((p) => p.name.trim() !== "")
    const lines: string[] = []
    lines.push(`合計 ¥${total.toLocaleString()} を ${personCount} 人で割り勘`)
    if (funSummary) lines.push(`★ ${funSummary}`)
    if (hasCustom || funAdjustment.type !== "none") {
      breakdown.forEach((b) => {
        lines.push(`${b.displayName}: ¥${b.amount.toLocaleString()}${b.isTarget ? " ★" : ""}`)
      })
    } else {
      const per = breakdown[0]?.amount ?? 0
      lines.push(`1人あたり ¥${per.toLocaleString()}`)
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      setCopied(true)
      toast.success("結果をコピーしました")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("コピーに失敗しました")
    }
  }

  const hasCustomNames = persons.some((p) => p.name.trim() !== "")
  const hasAdjustment = funAdjustment.type !== "none"
  const isWeighted = splitMode === "weighted"
  const showBreakdown = hasCustomNames || hasAdjustment || isWeighted

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
          <PersonStepper value={personCount} onChange={setPersonCount} />
        </div>

        {/* 名前を入力する */}
        <button
          type="button"
          onClick={() => setShowNamesEditor((v) => !v)}
          className="flex w-full items-center justify-between rounded-[10px] border border-[var(--wm-line)] bg-[var(--wm-surface)]/40 px-3 py-2 text-left transition hover:bg-[var(--wm-surface)]"
        >
          <span className="text-[12.5px] font-semibold text-[var(--wm-ink-2)]">
            {hasCustomNames ? "参加者の名前 (入力済)" : "参加者の名前を入れる (任意)"}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[var(--wm-ink-3)] transition-transform ${showNamesEditor ? "rotate-180" : ""}`}
          />
        </button>
        {showNamesEditor && (
          <div className="space-y-2">
            {persons.map((p, i) => {
              const w = weights[p.id] || "normal"
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: memberColorMap[p.id], color: "var(--wm-ink)" }}
                    >
                      {i + 1}
                    </span>
                    <Input
                      className="h-9 flex-1 text-[13.5px]"
                      placeholder={`${i + 1}人目 (例: たかし)`}
                      value={p.name}
                      onChange={(e) => {
                        const value = e.target.value
                        setPersons((prev) =>
                          prev.map((pp) => (pp.id === p.id ? { ...pp, name: value } : pp)),
                        )
                      }}
                      maxLength={20}
                    />
                  </div>
                  {isWeighted && (
                    <div className="flex gap-1 pl-9">
                      {(["less", "normal", "more"] as const).map((tier) => {
                        const active = w === tier
                        const label = tier === "more" ? "多め" : tier === "less" ? "少なめ" : "普通"
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() =>
                              setWeights((prev) => ({ ...prev, [p.id]: tier }))
                            }
                            className={`flex-1 rounded-[8px] border px-2 py-1.5 text-[11.5px] font-bold transition ${
                              active
                                ? tier === "more"
                                  ? "border-orange-400 bg-orange-100 text-orange-700"
                                  : tier === "less"
                                  ? "border-blue-400 bg-blue-100 text-blue-700"
                                  : "border-[var(--wm-accent)] bg-[var(--wm-accent-soft)] text-[var(--wm-accent-pressed)]"
                                : "border-[var(--wm-line)] bg-card text-[var(--wm-ink-3)] hover:bg-[var(--wm-surface)]"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {isWeighted && (
              <p className="text-[11px] text-[var(--wm-ink-3)]">
                比率: 多め × 1.5 / 普通 × 1.0 / 少なめ × 0.5
              </p>
            )}
          </div>
        )}
      </div>

      {/* 割り方 */}
      <div className="wm-card p-3 space-y-2">
        <Label className="text-[11px] font-semibold tracking-wider text-[var(--wm-ink-3)]">
          割り方
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSplitMode("equal")}
            className={`rounded-[10px] py-2 text-[12.5px] font-semibold transition ${
              splitMode === "equal"
                ? "bg-[var(--wm-accent)] text-white"
                : "bg-[var(--wm-surface)] text-[var(--wm-ink-2)] hover:bg-[var(--wm-surface)]/80"
            }`}
            aria-pressed={splitMode === "equal"}
          >
            均等に割る
          </button>
          <button
            type="button"
            onClick={() => setSplitMode("weighted")}
            className={`rounded-[10px] py-2 text-[12.5px] font-semibold transition ${
              splitMode === "weighted"
                ? "bg-[var(--wm-accent)] text-white"
                : "bg-[var(--wm-surface)] text-[var(--wm-ink-2)] hover:bg-[var(--wm-surface)]/80"
            }`}
            aria-pressed={splitMode === "weighted"}
          >
            金額に差をつける
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--wm-ink-3)]">
          {splitMode === "weighted"
            ? "「多め (×1.5)」「普通 (×1.0)」「少なめ (×0.5)」を各人に設定。よく飲む人を多めにできます。"
            : "全員を均等に割ります。"}
        </p>
      </div>


      {/* お楽しみ調整 */}
      <div className="rounded-[14px] border border-[var(--wm-line)] bg-card p-3">
        <button
          type="button"
          onClick={() => setShowFun((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Radio className="h-4 w-4 text-[var(--wm-accent)]" />
            お楽しみ調整
            <Badge variant="secondary" className="text-[10px]">任意</Badge>
          </span>
          <span className="text-[11.5px] text-[var(--wm-ink-3)]">
            {showFun ? "閉じる" : funSummary || "ルーレットを試す"}
          </span>
        </button>

        {showFun && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={spinningAdjustmentType !== null || rouletteCandidates.length < 2}
                onClick={() => runRandomFunAdjustment("remainder_roulette")}
                className={`rounded-[10px] border bg-card p-3 text-left transition hover:bg-[var(--wm-surface)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  funAdjustment.type === "remainder_roulette" ? "border-[var(--wm-accent)] ring-1 ring-[var(--wm-accent)]" : "border-[var(--wm-line)]"
                }`}
              >
                <span className="block text-[12.5px] font-semibold">端数だけルーレット</span>
                <span className="mt-1 block text-[10.5px] text-[var(--wm-ink-3)]">100円未満を1人に寄せる</span>
              </button>
              <button
                type="button"
                disabled={spinningAdjustmentType !== null || rouletteCandidates.length < 2}
                onClick={() => runRandomFunAdjustment("lucky_discount")}
                className={`rounded-[10px] border bg-card p-3 text-left transition hover:bg-[var(--wm-surface)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  funAdjustment.type === "lucky_discount" ? "border-[var(--wm-accent)] ring-1 ring-[var(--wm-accent)]" : "border-[var(--wm-line)]"
                }`}
              >
                <span className="block text-[12.5px] font-semibold">1人だけ500円引き</span>
                <span className="mt-1 block text-[10.5px] text-[var(--wm-ink-3)]">ランダムでラッキー割</span>
              </button>
              <button
                type="button"
                disabled={spinningAdjustmentType !== null || rouletteCandidates.length < 1}
                onClick={() => runRandomFunAdjustment("full_burden_roulette")}
                className={`rounded-[10px] border bg-card p-3 text-left transition hover:bg-[var(--wm-surface)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  funAdjustment.type === "full_burden_roulette" ? "border-[var(--wm-accent)] ring-1 ring-[var(--wm-accent)]" : "border-[var(--wm-line)]"
                }`}
              >
                <span className="block text-[12.5px] font-semibold">全額負担ルーレット</span>
                <span className="mt-1 block text-[10.5px] text-[var(--wm-ink-3)]">止まった人が全額担当</span>
              </button>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={funAdjustment.type === "none" || spinningAdjustmentType !== null}
                onClick={() => setFunAdjustment({ type: "none" })}
              >
                <X className="mr-1 h-4 w-4" />
                解除
              </Button>
            </div>

            {/* ルーレット演出 */}
            {spinningAdjustmentType && rouletteMembers.length > 0 && (
              <div className="wm-roulette-stage space-y-3 rounded-lg p-3" aria-live="polite">
                <div className="relative z-10 flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-[#F2C14E]" />
                    {spinningLabel}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {roulettePreview && (
                      <span className="hidden max-w-[8rem] truncate rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white/80 sm:inline-flex">
                        {roulettePreview.display_name}
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

            {/* ルーレット結果 */}
            {!spinningAdjustmentType && funSummary && targetPerson && (
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
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--wm-accent)]" />
                  <span
                    className="max-w-full rounded-full px-2.5 py-1 text-xs font-black text-foreground sm:max-w-[9rem] sm:truncate"
                    style={{ backgroundColor: memberColorMap[targetPerson.id] || "var(--wm-surface)" }}
                  >
                    {displayNameFor(targetPerson, persons.findIndex((p) => p.id === targetPerson.id))}
                  </span>
                  <span className="min-w-0 leading-relaxed">{resultLabel}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="relative z-10 h-8 shrink-0"
                  onClick={() => {
                    if (funAdjustment.type !== "none") runRandomFunAdjustment(funAdjustment.type)
                  }}
                >
                  やり直す
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 結果カード */}
      {result && breakdown && (
        <>
          {!showBreakdown ? (
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--wm-ink)", color: "#fff" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">1人あたり</div>
                  <div className="wm-num mt-1 text-[36px] font-bold leading-none tracking-tight">
                    ¥{(breakdown[0]?.amount ?? 0).toLocaleString()}
                    {(breakdown[0]?.amount ?? 0) !== (breakdown[breakdown.length - 1]?.amount ?? 0) && (
                      <span className="ml-2 text-[14px] font-semibold opacity-70">
                        〜¥{(breakdown[breakdown.length - 1]?.amount ?? 0).toLocaleString()}
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
                  <span className="wm-num font-bold">{personCount}</span> 人で割り勘
                </span>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--wm-ink)", color: "#fff" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">合計</div>
                  <div className="wm-num mt-1 text-[28px] font-bold leading-none tracking-tight">
                    ¥{total.toLocaleString()}
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
              {funSummary && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.1] px-2.5 py-1 text-[11px] font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {funSummary}
                </div>
              )}
            </div>
          )}

          {/* 内訳 (per-person) */}
          {showBreakdown && (
            <div className="wm-card p-3 space-y-1.5">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-[var(--wm-ink-3)]">
                1人ごとの金額
              </div>
              {breakdown.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between rounded-[10px] px-3 py-2.5 ${
                    b.isTarget ? "ring-1 ring-[var(--wm-accent)]" : ""
                  }`}
                  style={{ background: memberColorMap[b.id] }}
                >
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
                    {b.isTarget && <Sparkles className="h-3.5 w-3.5 text-[var(--wm-accent-pressed)]" />}
                    {b.displayName}
                  </span>
                  <span className="wm-num text-[16px] font-bold text-foreground">
                    ¥{b.amount.toLocaleString()}
                  </span>
                </div>
              ))}
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
