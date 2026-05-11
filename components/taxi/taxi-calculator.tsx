"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CalculationMode, FareSettings, Modifier, Segment, VehicleType } from "@/lib/types/taxi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Car, ChevronDown, Minus, Moon, Plus, Settings2, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"

interface TaxiCalculatorProps {
  showBackLink?: boolean
  backLinkHref?: string
  backLinkText?: string
  tableId?: string
  currentUserId?: string
}

const DEFAULT_TAXI_SETTINGS: FareSettings = {
  baseKm: 1.2,
  basePrice: 500,
  perKmPrice: 100,
  pickupFee: 0,
}

const DEFAULT_DAIKO_SETTINGS: FareSettings = {
  baseKm: 2,
  basePrice: 1000,
  perKmPrice: 200,
  extraFromKm: 10,
  extraPerKm: 100,
  pickupFee: 0,
}

const NIGHT_SURCHARGE_ID = "_preset_night"

type SegmentShareResult = Segment & {
  riderCount: number
  segmentFare: number
  perPersonShare: number
}

type PassengerShare = {
  id: string
  name: string
  amount: number
  count: number  // この地点で降りる人数
}

type TotalResult = {
  mode: "total"
  totalFare: number
  perPerson: number
  personCount: number
  remainder: number
}

type SameResult = {
  mode: "same"
  totalDistance: number
  totalFare: number
  perPerson: number
  personCount: number
  remainder: number
  pickupPerPerson: number
}

type SegmentsResult = {
  mode: "segments"
  totalDistance: number
  totalFare: number
  pricePerKm: number
  pickupPerPerson: number
  totalPassengers: number
  segments: SegmentShareResult[]
  passengers: PassengerShare[]
}

type CalcResult = TotalResult | SameResult | SegmentsResult

const PERSON_MIN = 1
const PERSON_MAX = 30

function clampPersonCount(value: number) {
  if (!Number.isFinite(value)) return PERSON_MIN
  return Math.min(PERSON_MAX, Math.max(PERSON_MIN, Math.floor(value)))
}

function PersonStepper({
  value,
  onChange,
  ariaLabel = "人数",
}: {
  value: number
  onChange: (next: number) => void
  ariaLabel?: string
}) {
  const dec = () => onChange(clampPersonCount(value - 1))
  const inc = () => onChange(clampPersonCount(value + 1))
  return (
    <div
      className="inline-flex items-stretch overflow-hidden rounded-[14px] border border-[var(--wm-line)] bg-card"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= PERSON_MIN}
        className="inline-flex h-12 w-12 items-center justify-center text-[var(--wm-ink-2)] transition active:bg-[var(--wm-surface)] disabled:opacity-30"
        aria-label="減らす"
      >
        <Minus className="h-5 w-5" />
      </button>
      <div className="flex min-w-[64px] items-center justify-center border-x border-[var(--wm-line)] px-3">
        <span className="wm-num text-[20px] font-bold tabular-nums leading-none">{value}</span>
        <span className="ml-0.5 text-[12px] text-[var(--wm-ink-3)]">人</span>
      </div>
      <button
        type="button"
        onClick={inc}
        disabled={value >= PERSON_MAX}
        className="inline-flex h-12 w-12 items-center justify-center text-[var(--wm-ink-2)] transition active:bg-[var(--wm-surface)] disabled:opacity-30"
        aria-label="増やす"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}

export function TaxiCalculator({
  showBackLink: _showBackLink = true,
  backLinkHref: _backLinkHref = "/",
  backLinkText: _backLinkText = "トップに戻る",
  tableId,
  currentUserId,
}: TaxiCalculatorProps) {
  const [vehicleType, setVehicleType] = useState<VehicleType>("taxi")
  const [taxiSettings, setTaxiSettings] = useState<FareSettings>(DEFAULT_TAXI_SETTINGS)
  const [daikoSettings, setDaikoSettings] = useState<FareSettings>(DEFAULT_DAIKO_SETTINGS)
  const settings = vehicleType === "taxi" ? taxiSettings : daikoSettings
  const setSettings = vehicleType === "taxi" ? setTaxiSettings : setDaikoSettings

  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [nightSurcharge, setNightSurcharge] = useState(false)
  const [mode, setMode] = useState<CalculationMode>("total")
  const [totalAmount, setTotalAmount] = useState("")
  const [totalPersonCount, setTotalPersonCount] = useState(2)
  const [sameDistance, setSameDistance] = useState("")
  const [samePersonCount, setSamePersonCount] = useState(2)
  const [segments, setSegments] = useState<Segment[]>([{ id: "1", name: "", distanceKm: 0, dropCount: 1 }])
  const [, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showLongDistanceSettings, setShowLongDistanceSettings] = useState(false)
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())
  const lastSavedHash = useRef<string | null>(null)
  const lastRemoteCreatedAt = useRef<string | null>(null)

  const applyRecord = useCallback((data: Record<string, unknown>) => {
    const savedSettings = (data.settings || {}) as FareSettings
    if (data.vehicle_type === "daiko") {
      setVehicleType("daiko")
      setDaikoSettings({ ...DEFAULT_DAIKO_SETTINGS, ...savedSettings })
    } else {
      setVehicleType("taxi")
      setTaxiSettings({ ...DEFAULT_TAXI_SETTINGS, ...savedSettings })
    }
    if (data.input) {
      const input = data.input as Record<string, unknown>
      setTotalAmount((input.totalAmount as string) ?? "")
      const tp = Number.parseInt(String(input.totalPersonCount ?? ""), 10)
      setTotalPersonCount(Number.isFinite(tp) && tp > 0 ? clampPersonCount(tp) : 2)
      setSameDistance((input.sameDistance as string) ?? "")
      const sp = Number.parseInt(String(input.samePersonCount ?? ""), 10)
      setSamePersonCount(Number.isFinite(sp) && sp > 0 ? clampPersonCount(sp) : 2)
      // 後方互換: dropCountがないセグメントにはデフォルト1を設定
      const savedSegments = ((input.segments as Segment[]) ?? [{ id: "1", name: "", distanceKm: 0, dropCount: 1 }])
      setSegments(savedSegments.map((s: Segment) => ({ ...s, dropCount: s.dropCount ?? 1 })))
      setMode((input.mode as CalculationMode) ?? "total")
      setNightSurcharge(Boolean(input.nightSurcharge))
      if (Array.isArray(input.modifiers)) {
        setModifiers(input.modifiers as Modifier[])
      }
    }
    if (data.created_at) {
      lastRemoteCreatedAt.current = data.created_at as string
    }
    try {
      lastSavedHash.current = JSON.stringify({
        tableId,
        vehicleType: data.vehicle_type,
        mode: data.mode,
        settings: savedSettings,
        input: data.input || {},
        result: data.result || {},
      })
    } catch {
      lastSavedHash.current = null
    }
  }, [tableId])

  const fetchLatestRecord = useCallback(async () => {
    if (!tableId) return
    const res = await fetch(`/api/taxi-records?tableId=${tableId}`)
    if (!res.ok) return
    const json = (await res.json()) as { data?: Record<string, unknown> }
    const data = json.data
    if (!data) return
    if (lastRemoteCreatedAt.current && (data.created_at as string) <= lastRemoteCreatedAt.current) return
    applyRecord(data)
  }, [tableId, applyRecord])

  useEffect(() => {
    void fetchLatestRecord()
    const interval = setInterval(fetchLatestRecord, 5000)
    return () => clearInterval(interval)
  }, [fetchLatestRecord])

  const updateSetting = (key: keyof FareSettings, raw: string, parser: (v: string) => number) => {
    const parsed = raw === "" ? Number.NaN : parser(raw)
    setSettings({ ...settings, [key]: parsed } as FareSettings)
  }

  const addModifier = () => {
    setModifiers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", amount: 0, type: "fixed", direction: "add", enabled: true },
    ])
  }
  const updateModifier = (id: string, updates: Partial<Modifier>) =>
    setModifiers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  const removeModifier = (id: string) => setModifiers((prev) => prev.filter((m) => m.id !== id))

  const addSegment = () => setSegments((prev) => [...prev, { id: Date.now().toString(), name: "", distanceKm: 0, dropCount: 1 }])
  const updateSegment = (id: string, updates: Partial<Segment>) =>
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  const removeSegment = (id: string) => segments.length > 1 && setSegments((prev) => prev.filter((s) => s.id !== id))

  const hasLongDistance = (settings.extraFromKm !== undefined && !Number.isNaN(settings.extraFromKm) && settings.extraFromKm > 0) ||
    (settings.extraPerKm !== undefined && !Number.isNaN(settings.extraPerKm) && settings.extraPerKm > 0)

  const settingsInvalid = mode === "total"
    ? false
    : (
      // 基本パラメータ: baseKm > 0, その他 >= 0
      (settings.baseKm === undefined || Number.isNaN(settings.baseKm) || settings.baseKm <= 0) ||
      [settings.basePrice, settings.perKmPrice, settings.pickupFee].some(
        (v) => v === undefined || Number.isNaN(v) || v < 0,
      ) ||
      // 長距離設定: 片方のみ入力は不可
      (hasLongDistance && (
        settings.extraFromKm === undefined || Number.isNaN(settings.extraFromKm) || settings.extraFromKm <= 0 ||
        settings.extraPerKm === undefined || Number.isNaN(settings.extraPerKm) || settings.extraPerKm < 0
      )) ||
      // 長距離閾値は初乗り距離以上であること
      (hasLongDistance && settings.extraFromKm !== undefined && !Number.isNaN(settings.extraFromKm) &&
        settings.extraFromKm < (settings.baseKm || 0))
    )

  // 深夜割増プリセットを内部 modifier として合成
  const effectiveModifiers = useMemo<Modifier[]>(() => {
    if (!nightSurcharge) return modifiers
    return [
      ...modifiers,
      { id: NIGHT_SURCHARGE_ID, name: "深夜割増", amount: 20, type: "percent", direction: "add", enabled: true },
    ]
  }, [modifiers, nightSurcharge])

  const results = useMemo<CalcResult | null>(() => {
    // total モード: 総額を直接入力 → 人数で均等割り
    if (mode === "total") {
      const total = Number.parseInt(totalAmount, 10)
      const personCount = clampPersonCount(totalPersonCount)
      if (!Number.isFinite(total) || total <= 0 || personCount <= 0) return null
      const perPerson = Math.floor(total / personCount)
      const remainder = total - perPerson * personCount
      return { mode: "total" as const, totalFare: total, perPerson, personCount, remainder }
    }

    // 距離ベース: 内部 helper
    const calculateBaseFare = (distanceKm: number) => {
      if (distanceKm <= 0) return 0
      let fare = (settings.basePrice || 0) + (settings.pickupFee || 0)
      if (distanceKm > (settings.baseKm || 0)) {
        const remainingKm = distanceKm - (settings.baseKm || 0)
        if (settings.extraFromKm && settings.extraPerKm && distanceKm > settings.extraFromKm) {
          const normalKm = settings.extraFromKm - (settings.baseKm || 0)
          const extraKm = distanceKm - settings.extraFromKm
          fare += normalKm * (settings.perKmPrice || 0) + extraKm * ((settings.perKmPrice || 0) + settings.extraPerKm)
        } else {
          fare += remainingKm * (settings.perKmPrice || 0)
        }
      }
      return fare
    }

    const applyModifiers = (baseFare: number) => {
      let fare = baseFare
      for (const mod of effectiveModifiers) {
        if (!mod.enabled) continue
        const adjustment = mod.type === "fixed" ? mod.amount : Math.floor(baseFare * (mod.amount / 100))
        fare = mod.direction === "add" ? fare + adjustment : fare - adjustment
      }
      return Math.max(0, Math.round(fare))
    }

    if (settingsInvalid) return null

    const pickupFee = settings.pickupFee || 0

    if (mode === "same") {
      const distance = Number.parseFloat(sameDistance) || 0
      const personCount = clampPersonCount(samePersonCount)
      if (distance <= 0 || personCount <= 0) return null
      const baseFare = calculateBaseFare(distance)
      const totalFare = applyModifiers(baseFare)

      const perPerson = Math.floor(totalFare / personCount)
      const remainder = totalFare - perPerson * personCount
      const pickupPerPerson = personCount > 0 ? Math.round(pickupFee / personCount) : 0
      return { mode: "same" as const, totalDistance: distance, totalFare, perPerson, personCount, remainder, pickupPerPerson }
    }

    const validSegments = segments.filter((s) => s.distanceKm > 0)
    if (validSegments.length === 0) return null
    const totalDistance = validSegments.reduce((sum, s) => sum + s.distanceKm, 0)
    if (totalDistance <= 0) return null

    const totalPassengers = validSegments.reduce((sum, s) => sum + (s.dropCount || 1), 0)
    if (totalPassengers <= 0) return null

    const baseFare = calculateBaseFare(totalDistance)
    const totalFare = applyModifiers(baseFare)

    const pickupPortion = Math.min(pickupFee, totalFare)
    const distancePortion = totalFare - pickupPortion
    const pricePerKm = totalDistance > 0 ? distancePortion / totalDistance : 0

    const pickupPerPersonRaw = totalPassengers > 0 ? pickupPortion / totalPassengers : 0

    let cumulativeDrops = 0
    const riderCounts: number[] = validSegments.map((s) => {
      const riders = totalPassengers - cumulativeDrops
      cumulativeDrops += (s.dropCount || 1)
      return riders
    })

    const distanceTotalsRaw = new Array<number>(validSegments.length).fill(0)

    const segmentResults: SegmentShareResult[] = validSegments.map((s, idx) => {
      const segmentFareRaw = s.distanceKm * pricePerKm
      const riderCount = riderCounts[idx]
      const perPersonShareRaw = riderCount > 0 ? segmentFareRaw / riderCount : 0

      for (let i = idx; i < validSegments.length; i++) {
        distanceTotalsRaw[i] += perPersonShareRaw
      }

      return {
        ...s,
        riderCount,
        segmentFare: Math.round(segmentFareRaw),
        perPersonShare: Math.round(perPersonShareRaw),
      }
    })

    const passengerTotalsRaw = distanceTotalsRaw.map(v => v + pickupPerPersonRaw)

    const passengerAmounts = passengerTotalsRaw.map(v => Math.floor(v))
    const currentTotal = passengerAmounts.reduce((sum, v, idx) => sum + v * (validSegments[idx].dropCount || 1), 0)
    let remainderToDistribute = totalFare - currentTotal
    const fractionalParts = passengerTotalsRaw
      .map((raw, idx) => ({ idx, frac: raw - Math.floor(raw), dropCount: validSegments[idx].dropCount || 1 }))
      .sort((a, b) => b.frac - a.frac)
    for (const { idx, dropCount } of fractionalParts) {
      if (remainderToDistribute <= 0) break
      if (remainderToDistribute >= dropCount) {
        passengerAmounts[idx] += 1
        remainderToDistribute -= dropCount
      } else {
        passengerAmounts[idx] += 1
        remainderToDistribute -= dropCount
      }
    }
    for (let i = 0; remainderToDistribute > 0 && i < passengerAmounts.length; i++) {
      passengerAmounts[i] += 1
      remainderToDistribute -= (validSegments[i].dropCount || 1)
    }

    const passengers: PassengerShare[] = validSegments.map((s, idx) => ({
      id: s.id,
      name: s.name || `降車 ${idx + 1}`,
      amount: passengerAmounts[idx],
      count: s.dropCount || 1,
    }))

    const pickupPerPerson = Math.round(pickupPerPersonRaw)

    return { mode: "segments" as const, totalDistance, totalFare, pricePerKm, pickupPerPerson, totalPassengers, segments: segmentResults, passengers }
  }, [mode, totalAmount, totalPersonCount, sameDistance, samePersonCount, segments, settings, effectiveModifiers, settingsInvalid])

  // Auto-save to DB when results change
  useEffect(() => {
    if (!results || !tableId || !currentUserId) return
    const payloadHash = JSON.stringify({
      tableId,
      vehicleType,
      mode,
      settings,
      input: { totalAmount, totalPersonCount, sameDistance, samePersonCount, segments, mode, vehicleType, nightSurcharge, modifiers },
      result: results,
    })
    if (payloadHash === lastSavedHash.current) return

    const save = async () => {
      setIsSaving(true)
      const res = await fetch("/api/taxi-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          vehicleType,
          mode,
          settings,
          input: { totalAmount, totalPersonCount, sameDistance, samePersonCount, segments, mode, vehicleType, nightSurcharge, modifiers },
          result: results,
        }),
      })
      setIsSaving(false)
      if (!res.ok) {
        console.error("Failed to save taxi record:", await res.text())
        toast.error("保存に失敗しました")
        lastSavedHash.current = null
        return
      }

      const json = (await res.json()) as { data?: { created_at?: string } }
      lastSavedHash.current = payloadHash
      if (json?.data?.created_at) {
        lastRemoteCreatedAt.current = json.data.created_at
      }
    }

    void save()
  }, [results, tableId, currentUserId, vehicleType, mode, settings, totalAmount, totalPersonCount, sameDistance, samePersonCount, segments, nightSurcharge, modifiers])

  const isDistanceMode = mode === "same" || mode === "segments"

  return (
    <div className="space-y-3">
      {/* モードタブ */}
      <div className="wm-tabs">
        <button
          type="button"
          className={`wm-tab ${mode === "total" ? "is-active" : ""}`}
          onClick={() => setMode("total")}
        >
          金額
        </button>
        <button
          type="button"
          className={`wm-tab ${mode === "same" ? "is-active" : ""}`}
          onClick={() => setMode("same")}
        >
          距離
        </button>
        <button
          type="button"
          className={`wm-tab ${mode === "segments" ? "is-active" : ""}`}
          onClick={() => setMode("segments")}
        >
          区間別
        </button>
      </div>

      {/* メイン入力カード */}
      {mode === "total" && (
        <div className="wm-card p-4 space-y-4">
          <div>
            <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">メーター金額</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] font-semibold text-[var(--wm-ink-3)]">¥</span>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="3200"
                className="wm-num h-14 pl-10 pr-4 text-right text-[26px] font-bold placeholder:text-[var(--wm-ink-4)] placeholder:font-normal"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">人数</Label>
            <PersonStepper value={totalPersonCount} onChange={setTotalPersonCount} />
          </div>
        </div>
      )}

      {mode === "same" && (
        <div className="wm-card p-4 space-y-4">
          <div>
            <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">距離 (km)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              className="wm-num mt-1.5 h-14 text-right text-[24px] font-bold placeholder:text-[var(--wm-ink-4)] placeholder:font-normal"
              placeholder="5.0"
              value={sameDistance}
              onChange={(e) => setSameDistance(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">人数</Label>
            <PersonStepper value={samePersonCount} onChange={setSamePersonCount} />
          </div>
        </div>
      )}

      {mode === "segments" && (
        <div className="wm-card p-4 space-y-3">
          <p className="text-[12px] leading-relaxed text-[var(--wm-ink-2)]">
            降車順に距離と降りる人数を入力。距離料金は乗車中の人数で按分されます。
          </p>

          <div className="space-y-2">
            {segments.map((seg, index) => {
              const isLast = index === segments.length - 1
              return (
                <div
                  key={seg.id}
                  className="rounded-[14px] border border-[var(--wm-line)] bg-card p-3 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: isLast ? "var(--wm-accent)" : "var(--wm-ink-3)" }}
                    >
                      {index + 1}
                    </span>
                    <Input
                      placeholder="降りる人・地点 (任意)"
                      className="h-10 flex-1 text-[13.5px]"
                      value={seg.name}
                      onChange={(e) => updateSegment(seg.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeSegment(seg.id)}
                      disabled={segments.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--wm-ink-3)] transition active:bg-[var(--wm-surface)] active:text-destructive disabled:opacity-30"
                      aria-label="この区間を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-[var(--wm-ink-3)]">この区間の距離</Label>
                      <div className="relative mt-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          inputMode="decimal"
                          placeholder="0.0"
                          className="wm-num h-11 pr-9 text-right text-[15px] font-semibold placeholder:text-[var(--wm-ink-4)] placeholder:font-normal"
                          value={seg.distanceKm || ""}
                          onChange={(e) =>
                            updateSegment(seg.id, { distanceKm: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) })
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--wm-ink-3)]">km</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-[var(--wm-ink-3)]">降りる人数</Label>
                      <div className="mt-1">
                        <PersonStepper
                          value={Math.max(1, seg.dropCount || 1)}
                          onChange={(n) => updateSegment(seg.id, { dropCount: clampPersonCount(n) })}
                          ariaLabel="この区間で降りる人数"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addSegment} className="w-full bg-card h-11">
            <Plus className="mr-1 h-4 w-4" />
            区間を追加
          </Button>
        </div>
      )}

      {/* 結果カード */}
      {results && (
        <>
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--wm-ink)", color: "#fff" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">
                  {results.mode === "total"
                    ? "合計料金"
                    : `合計料金 (${results.totalDistance.toFixed(1)} km)`}
                </div>
                <div className="wm-num mt-1 text-[30px] font-bold leading-none tracking-tight">
                  ¥{results.totalFare.toLocaleString()}
                </div>
              </div>
              {(results.mode === "total" || results.mode === "same") && (
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">
                    1人あたり
                  </div>
                  <div className="wm-num mt-1 text-[22px] font-bold">
                    ¥{results.perPerson.toLocaleString()}
                    {results.remainder > 0 && (
                      <span className="ml-0.5 text-[12px] font-medium opacity-70">
                        〜¥{(results.perPerson + 1).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(results.mode === "total" || results.mode === "same") && results.remainder > 0 && (
              <div className="mt-3 rounded-[10px] bg-white/[0.06] p-2.5 text-[11px] opacity-80">
                端数: {results.remainder} 人が +1 円 ({results.personCount - results.remainder}人 ¥{results.perPerson.toLocaleString()} / {results.remainder}人 ¥{(results.perPerson + 1).toLocaleString()})
              </div>
            )}

            {results.mode === "segments" && (
              <div className="mt-3.5 flex items-center justify-between text-[11px] opacity-70">
                <span>{results.totalPassengers}人乗車</span>
                <span className="wm-num">
                  距離単価 ¥{Math.round(results.pricePerKm).toLocaleString()}/km
                </span>
              </div>
            )}
          </div>

          {/* segments モード: 降りる順番タイムライン */}
          {results.mode === "segments" && (
            <div className="wm-card p-4">
              <h3 className="wm-h3 mb-3 text-[14px] font-semibold">降りる順番</h3>
              <div className="relative pl-8">
                <div
                  className="absolute left-[11px] top-3 bottom-3 w-[2px]"
                  style={{ background: "var(--wm-line-strong)" }}
                />
                {results.segments.map((seg, index) => {
                  const isExpanded = expandedSegments.has(seg.id)
                  const passenger = results.passengers[index]
                  const isLast = index === results.segments.length - 1
                  const toggleExpand = () => {
                    setExpandedSegments((prev) => {
                      const next = new Set(prev)
                      if (next.has(seg.id)) next.delete(seg.id)
                      else next.add(seg.id)
                      return next
                    })
                  }
                  return (
                    <div key={seg.id} className="relative pb-3 last:pb-0">
                      <span
                        className="absolute -left-[28px] top-1.5 inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{
                          background: isLast ? "var(--wm-accent)" : "var(--wm-ink-3)",
                          border: isLast ? "none" : "2px solid var(--wm-card)",
                          boxShadow: !isLast ? "0 0 0 2px var(--wm-line-strong)" : undefined,
                        }}
                      >
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={toggleExpand}
                        className="block w-full rounded-[12px] border border-[var(--wm-line)] bg-card px-3 py-2.5 text-left transition active:bg-[var(--wm-surface)]/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-medium">
                              {seg.name || `降車 ${index + 1}`}
                              {(passenger?.count ?? 1) > 1 && (
                                <span className="ml-1 text-[11px] text-[var(--wm-ink-3)]">
                                  ×{passenger.count}人
                                </span>
                              )}
                            </div>
                            <div className="wm-num mt-0.5 text-[11px] text-[var(--wm-ink-3)]">
                              {seg.distanceKm.toFixed(1)} km · {seg.riderCount}人乗車
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="wm-num text-[15px] font-bold text-[var(--wm-accent)]">
                              ¥{(passenger?.amount ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-[var(--wm-ink-3)]">/人</div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-1 rounded-[10px] bg-[var(--wm-surface)] p-2.5 text-[11px]">
                            <div className="font-semibold text-foreground">計算式</div>
                            <div className="text-[var(--wm-ink-3)]">
                              区間料金 = 距離 × km 単価
                            </div>
                            <div className="wm-num text-foreground">
                              = {seg.distanceKm.toFixed(1)} km × ¥{Math.round(results.pricePerKm).toLocaleString()}/km = ¥{seg.segmentFare.toLocaleString()}
                            </div>
                            <div className="text-[var(--wm-ink-3)] mt-1">
                              距離按分 ÷ 乗車人数
                            </div>
                            <div className="wm-num text-foreground">
                              = ¥{seg.segmentFare.toLocaleString()} ÷ {seg.riderCount}人 = ¥{seg.perPersonShare.toLocaleString()}
                            </div>
                            {results.pickupPerPerson > 0 && (
                              <div className="text-[var(--wm-ink-3)] mt-1">
                                + 迎車料金 (均等分割) = ¥{results.pickupPerPerson.toLocaleString()}/人
                              </div>
                            )}
                            <div className="mt-1.5 border-t border-[var(--wm-line)] pt-1.5 text-[var(--wm-ink-3)]">
                              この地点で降りる人の支払い (1人あたり)
                            </div>
                            <div className="wm-num font-bold text-foreground">
                              = ¥{(passenger?.amount ?? 0).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>

              {(settings.pickupFee || 0) > 0 && (
                <div className="mt-3 rounded-[10px] bg-[var(--wm-surface)] p-2.5 text-[11px] text-[var(--wm-ink-2)]">
                  迎車料金 ¥{(settings.pickupFee ?? 0).toLocaleString()} を {results.totalPassengers}人で均等分割
                  (1人あたり ¥{results.pickupPerPerson.toLocaleString()})
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-[var(--wm-line)] pt-2.5 text-[12px]">
                <span className="text-[var(--wm-ink-3)]">支払合計 ({results.totalPassengers}人)</span>
                <span className="wm-num font-semibold">
                  ¥{results.passengers.reduce((sum, p) => sum + p.amount * p.count, 0).toLocaleString()}
                  {results.passengers.reduce((sum, p) => sum + p.amount * p.count, 0) === results.totalFare && (
                    <span className="ml-1 text-[var(--wm-success)]">✓</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* クイックオプション (距離モードのみ) */}
      {isDistanceMode && (
        <div className="wm-card p-3">
          <button
            type="button"
            onClick={() => setNightSurcharge((v) => !v)}
            className={`flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left transition ${
              nightSurcharge ? "bg-[var(--wm-accent-soft)]" : "bg-transparent active:bg-[var(--wm-surface)]"
            }`}
            aria-pressed={nightSurcharge}
          >
            <span className="flex items-center gap-2">
              <Moon className={`h-4 w-4 ${nightSurcharge ? "text-[var(--wm-accent-pressed)]" : "text-[var(--wm-ink-3)]"}`} />
              <span className="text-[13.5px] font-semibold">深夜割増 +20%</span>
              <span className="text-[11px] text-[var(--wm-ink-3)]">22:00–05:00</span>
            </span>
            <Switch checked={nightSurcharge} onCheckedChange={setNightSurcharge} />
          </button>
        </div>
      )}

      {/* 詳細設定 (折りたたみ) */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[14px] border border-[var(--wm-line)] bg-card px-4 py-3 text-left transition active:bg-[var(--wm-surface)]"
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--wm-ink-2)]">
              <Settings2 className="h-4 w-4" />
              詳細設定
              {mode === "total" && (
                <span className="ml-1 text-[11px] font-normal text-[var(--wm-ink-3)]">(金額モードでは未使用)</span>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-[var(--wm-ink-3)] transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {/* 車種切替 */}
          {isDistanceMode && (
            <div className="wm-tabs">
              <button
                type="button"
                className={`wm-tab ${vehicleType === "taxi" ? "is-active" : ""}`}
                onClick={() => setVehicleType("taxi")}
              >
                <Car className="mr-1.5 inline-block h-3.5 w-3.5" />
                タクシー
              </button>
              <button
                type="button"
                className={`wm-tab ${vehicleType === "daiko" ? "is-active" : ""}`}
                onClick={() => setVehicleType("daiko")}
              >
                <Truck className="mr-1.5 inline-block h-3.5 w-3.5" />
                運転代行
              </button>
            </div>
          )}

          {/* 料金設定 */}
          {isDistanceMode && (
            <div className="wm-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="wm-h3 text-[14px] font-semibold">料金設定</h3>
                <span className="wm-meta">{vehicleType === "taxi" ? "タクシー" : "運転代行"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
                    初乗り距離 (km)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    className="wm-num mt-1"
                    value={Number.isNaN(settings.baseKm) ? "" : settings.baseKm}
                    onChange={(e) => updateSetting("baseKm", e.target.value, Number.parseFloat)}
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">初乗り料金</Label>
                  <Input
                    type="number"
                    min="0"
                    className="wm-num mt-1"
                    value={Number.isNaN(settings.basePrice) ? "" : settings.basePrice}
                    onChange={(e) => updateSetting("basePrice", e.target.value, Number.parseInt)}
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
                    加算単価 (/km)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    className="wm-num mt-1"
                    value={Number.isNaN(settings.perKmPrice) ? "" : settings.perKmPrice}
                    onChange={(e) => updateSetting("perKmPrice", e.target.value, Number.parseInt)}
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">迎車料金</Label>
                  <Input
                    type="number"
                    min="0"
                    className="wm-num mt-1"
                    value={Number.isNaN(settings.pickupFee) ? "" : settings.pickupFee}
                    onChange={(e) => updateSetting("pickupFee", e.target.value, Number.parseInt)}
                  />
                </div>
              </div>

              <Collapsible open={showLongDistanceSettings} onOpenChange={setShowLongDistanceSettings}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-[13px]">
                    長距離割増設定
                    <ChevronDown className={`h-4 w-4 transition-transform ${showLongDistanceSettings ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3 rounded-[12px] bg-[var(--wm-surface)] p-3">
                    <div>
                      <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
                        長距離閾値 (km)
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="wm-num mt-1 bg-card"
                        placeholder={vehicleType === "daiko" ? "10" : "未設定"}
                        value={Number.isNaN(settings.extraFromKm ?? Number.NaN) ? "" : settings.extraFromKm}
                        onChange={(e) => updateSetting("extraFromKm", e.target.value, Number.parseFloat)}
                      />
                    </div>
                    <div>
                      <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">
                        追加単価 (/km)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="wm-num mt-1 bg-card"
                        placeholder={vehicleType === "daiko" ? "100" : "未設定"}
                        value={Number.isNaN(settings.extraPerKm ?? Number.NaN) ? "" : settings.extraPerKm}
                        onChange={(e) => updateSetting("extraPerKm", e.target.value, Number.parseInt)}
                      />
                    </div>
                    <p className="col-span-2 text-[11px] text-[var(--wm-ink-3)]">
                      閾値を超えた距離分に追加単価が上乗せされます
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {settingsInvalid && (
                <p className="text-[12px] text-destructive">
                  {(settings.baseKm === undefined || Number.isNaN(settings.baseKm) || settings.baseKm <= 0)
                    ? "初乗り距離は0より大きい値を入力してください。"
                    : hasLongDistance && settings.extraFromKm !== undefined && !Number.isNaN(settings.extraFromKm) && settings.extraFromKm < (settings.baseKm || 0)
                    ? "長距離閾値は初乗り距離以上に設定してください。"
                    : "0以上の値をすべて入力してください。"}
                </p>
              )}
            </div>
          )}

          {/* カスタム割増・割引 */}
          {isDistanceMode && (
            <div className="wm-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="wm-h3 text-[14px] font-semibold">カスタム割増・割引</h3>
                <Button variant="outline" size="sm" onClick={addModifier} className="bg-card">
                  <Plus className="mr-1 h-4 w-4" />
                  追加
                </Button>
              </div>
              <div>
                {modifiers.length === 0 ? (
                  <p className="text-center text-[12px] text-[var(--wm-ink-3)] py-3">深夜割増以外を追加したいときに利用</p>
                ) : (<>
                  <p className="mb-2 text-[11px] text-[var(--wm-ink-3)]">※ % は基本運賃 (距離料金 + 迎車料金) に対して適用 (切り捨て)</p>
                  <div className="space-y-3">
                    {modifiers.map((mod) => (
                      <div
                        key={mod.id}
                        className="grid grid-cols-1 gap-2 p-3 bg-muted/50 rounded sm:grid-cols-[auto,1fr,120px,110px,110px,auto] sm:items-center"
                      >
                        <div className="flex items-center gap-2">
                          <Switch checked={mod.enabled} onCheckedChange={(checked) => updateModifier(mod.id, { enabled: checked })} />
                          <span className="text-xs text-muted-foreground hidden sm:inline">適用</span>
                        </div>
                        <Input
                          placeholder="名称"
                          className="h-10 sm:h-8 w-full"
                          value={mod.name}
                          onChange={(e) => updateModifier(mod.id, { name: e.target.value })}
                        />
                        <Input
                          type="number"
                          className="h-10 sm:h-8 w-full"
                          value={Number.isNaN(mod.amount) ? "" : mod.amount}
                          onChange={(e) =>
                            updateModifier(mod.id, {
                              amount: e.target.value === "" ? Number.NaN : Number.parseFloat(e.target.value),
                            })
                          }
                        />
                        <Select value={mod.type} onValueChange={(v) => updateModifier(mod.id, { type: v as "fixed" | "percent" })}>
                          <SelectTrigger className="w-full sm:w-24 h-10 sm:h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">円</SelectItem>
                            <SelectItem value="percent">%</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={mod.direction}
                          onValueChange={(v) => updateModifier(mod.id, { direction: v as "add" | "subtract" })}
                        >
                          <SelectTrigger className="w-full sm:w-24 h-10 sm:h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="add">加算</SelectItem>
                            <SelectItem value="subtract">減算</SelectItem>
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 sm:h-8 sm:w-8 text-destructive hover:text-destructive justify-self-start"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>オプションを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeModifier(mod.id)}>削除する</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </>)}
              </div>
            </div>
          )}

          {mode === "total" && (
            <div className="wm-card p-4 text-[12px] text-[var(--wm-ink-2)]">
              金額モードはメーター金額を直接入力するため、車種・料金設定・割増は使用されません。距離から運賃を推定したい場合は「距離」または「区間別」モードを選んでください。
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
