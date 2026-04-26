"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CalculationMode, FareSettings, Modifier, Segment, VehicleType } from "@/lib/types/taxi"
import { formatCurrency } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Calculator, Car, ChevronDown, Plus, Trash2, Truck, Users } from "lucide-react"
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
  const [mode, setMode] = useState<CalculationMode>("same")
  const [sameDistance, setSameDistance] = useState("")
  const [samePersonCount, setSamePersonCount] = useState("1")
  const [segments, setSegments] = useState<Segment[]>([{ id: "1", name: "", distanceKm: 0, dropCount: 1 }])
  const [_isSaving, setIsSaving] = useState(false)
  const [showLongDistanceSettings, setShowLongDistanceSettings] = useState(vehicleType === "daiko")
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
      setSameDistance((input.sameDistance as string) ?? "")
      setSamePersonCount((input.samePersonCount as string) ?? "1")
      // 後方互換: dropCountがないセグメントにはデフォルト1を設定
      const savedSegments = ((input.segments as Segment[]) ?? [{ id: "1", name: "", distanceKm: 0, dropCount: 1 }])
      setSegments(savedSegments.map((s: Segment) => ({ ...s, dropCount: s.dropCount ?? 1 })))
      setMode((input.mode as CalculationMode) ?? "same")
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

  const settingsInvalid =
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

  const results = useMemo<
    | { mode: "same"; totalDistance: number; totalFare: number; perPerson: number; personCount: number; remainder: number; pickupPerPerson: number }
    | {
        mode: "segments"
        totalDistance: number
        totalFare: number
        pricePerKm: number
        pickupPerPerson: number
        totalPassengers: number
        segments: SegmentShareResult[]
        passengers: PassengerShare[]
      }
    | null
  >(() => {
    // Helper functions moved inside useMemo to satisfy exhaustive-deps
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
      for (const mod of modifiers) {
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
      const personCount = Number.parseInt(samePersonCount, 10) || 1
      if (distance <= 0 || personCount <= 0) return null
      const baseFare = calculateBaseFare(distance)
      const totalFare = applyModifiers(baseFare)

      // 同距離モードでは全員同じ距離なので迎車分割も距離按分も結果は同じ
      // 合計一致の端数配分: floor + remainder
      const perPerson = Math.floor(totalFare / personCount)
      const remainder = totalFare - perPerson * personCount
      const pickupPerPerson = personCount > 0 ? Math.round(pickupFee / personCount) : 0
      return { mode: "same" as const, totalDistance: distance, totalFare, perPerson, personCount, remainder, pickupPerPerson }
    }

    const validSegments = segments.filter((s) => s.distanceKm > 0)
    if (validSegments.length === 0) return null
    const totalDistance = validSegments.reduce((sum, s) => sum + s.distanceKm, 0)
    if (totalDistance <= 0) return null

    // 乗車人数 = 全区間のdropCountの合計
    const totalPassengers = validSegments.reduce((sum, s) => sum + (s.dropCount || 1), 0)
    if (totalPassengers <= 0) return null

    const baseFare = calculateBaseFare(totalDistance)
    const totalFare = applyModifiers(baseFare)

    // 迎車料金は全員で均等分割、残りは距離按分
    const pickupPortion = Math.min(pickupFee, totalFare)
    const distancePortion = totalFare - pickupPortion
    const pricePerKm = totalDistance > 0 ? distancePortion / totalDistance : 0

    // 迎車料金の一人あたり（理論値）
    const pickupPerPersonRaw = totalPassengers > 0 ? pickupPortion / totalPassengers : 0

    // 各区間の乗車人数を計算（降車済み人数を累積）
    let cumulativeDrops = 0
    const riderCounts: number[] = validSegments.map((s) => {
      const riders = totalPassengers - cumulativeDrops
      cumulativeDrops += (s.dropCount || 1)
      return riders
    })

    // 距離按分の理論値を各降車地点ごとに蓄積
    const distanceTotalsRaw = new Array<number>(validSegments.length).fill(0)

    const segmentResults: SegmentShareResult[] = validSegments.map((s, idx) => {
      const segmentFareRaw = s.distanceKm * pricePerKm
      const riderCount = riderCounts[idx]
      const perPersonShareRaw = riderCount > 0 ? segmentFareRaw / riderCount : 0

      // この区間以降に降りる全員に距離按分を加算
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

    // 各降車地点の一人あたり支払い = 距離按分 + 迎車均等分
    const passengerTotalsRaw = distanceTotalsRaw.map(v => v + pickupPerPersonRaw)

    // 合計一致の端数配分:
    // 1. 全員 floor で円に落とす（dropCount考慮）
    const passengerAmounts = passengerTotalsRaw.map(v => Math.floor(v))
    // 2. 不足分を計算（各地点の人数 × 金額の合計がtotalFareに一致すべき）
    const currentTotal = passengerAmounts.reduce((sum, v, idx) => sum + v * (validSegments[idx].dropCount || 1), 0)
    let remainderToDistribute = totalFare - currentTotal
    // 3. 端数（小数部分）が大きい降車地点から、dropCount分ずつ配分
    const fractionalParts = passengerTotalsRaw
      .map((raw, idx) => ({ idx, frac: raw - Math.floor(raw), dropCount: validSegments[idx].dropCount || 1 }))
      .sort((a, b) => b.frac - a.frac)
    for (const { idx, dropCount } of fractionalParts) {
      if (remainderToDistribute <= 0) break
      // この地点のdropCount人全員に+1円（合計でdropCount円増加）
      if (remainderToDistribute >= dropCount) {
        passengerAmounts[idx] += 1
        remainderToDistribute -= dropCount
      } else {
        // 余りがdropCountより少ない場合は1円ずつ（表示上は同額にならないが合計一致優先）
        passengerAmounts[idx] += 1
        remainderToDistribute -= dropCount
      }
    }
    // 残りがまだある場合（稀だが安全のため）
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
  }, [mode, sameDistance, samePersonCount, segments, settings, modifiers, settingsInvalid])

  // Auto-save to DB when results change
  useEffect(() => {
    if (!results || !tableId || !currentUserId) return
    const payloadHash = JSON.stringify({
      tableId,
      vehicleType,
      mode,
      settings,
      input: { sameDistance, samePersonCount, segments, mode, vehicleType },
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
          input: { sameDistance, samePersonCount, segments, mode, vehicleType },
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
  }, [results, tableId, currentUserId, vehicleType, mode, settings, sameDistance, samePersonCount, segments])

  return (
    <div className="space-y-4">
      {/* 車種切替 wm-tabs */}
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

      {/* 料金設定 */}
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

      {/* 割増・割引オプション */}
      <div className="wm-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="wm-h3 text-[14px] font-semibold">割増・割引</h3>
          <Button variant="outline" size="sm" onClick={addModifier} className="bg-card">
            <Plus className="mr-1 h-4 w-4" />
            追加
          </Button>
        </div>
        <div>
          {modifiers.length === 0 ? (
            <p className="text-center text-[12px] text-[var(--wm-ink-3)] py-4">オプションはありません</p>
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

      {/* 距離入力 */}
      <div className="wm-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[var(--wm-ink-2)]" />
          <h3 className="wm-h3 text-[14px] font-semibold">距離入力</h3>
        </div>

        <div className="wm-tabs">
          <button
            type="button"
            className={`wm-tab ${mode === "same" ? "is-active" : ""}`}
            onClick={() => setMode("same")}
          >
            全員同じ距離
          </button>
          <button
            type="button"
            className={`wm-tab ${mode === "segments" ? "is-active" : ""}`}
            onClick={() => setMode("segments")}
          >
            区間別
          </button>
        </div>

        {mode === "same" && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">距離 (km)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                className="wm-num mt-1"
                placeholder="5.0"
                value={sameDistance}
                onChange={(e) => setSameDistance(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px] font-semibold text-[var(--wm-ink-2)]">人数</Label>
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                className="wm-num mt-1"
                value={samePersonCount}
                onChange={(e) => setSamePersonCount(e.target.value)}
              />
            </div>
          </div>
        )}

        {mode === "segments" && (
          <div className="space-y-3 pt-1">
            <div className="rounded-[12px] bg-[var(--wm-surface)] p-3 text-[12px] text-[var(--wm-ink-2)]">
              降車順に、各区間の距離と降車人数を入力してください。距離料金は乗車中の人数で按分、迎車料金は全員で均等分割されます。
            </div>

            {/* 区間タイムライン入力 */}
            <div className="relative pl-7">
              <div
                className="absolute left-[11px] top-3 bottom-3 w-[2px]"
                style={{ background: "var(--wm-line-strong)" }}
              />
              {segments.map((seg, index) => {
                const isLast = index === segments.length - 1
                return (
                  <div key={seg.id} className="relative pb-3">
                    <span
                      className="absolute -left-[28px] top-2 inline-flex h-[20px] w-[20px] items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{
                        background: isLast ? "var(--wm-accent)" : "var(--wm-ink-3)",
                      }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="降りる人・地点"
                        className="h-9 flex-1 text-[13px]"
                        value={seg.name}
                        onChange={(e) => updateSegment(seg.id, { name: e.target.value })}
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        placeholder="km"
                        className="wm-num h-9 w-16 text-right text-[13px]"
                        value={seg.distanceKm || ""}
                        onChange={(e) =>
                          updateSegment(seg.id, { distanceKm: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) })
                        }
                      />
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        placeholder="人"
                        className="wm-num h-9 w-12 text-center text-[13px]"
                        value={seg.dropCount || 1}
                        onChange={(e) =>
                          updateSegment(seg.id, { dropCount: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeSegment(seg.id)}
                        disabled={segments.length === 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--wm-ink-3)] transition hover:bg-[var(--wm-surface)] hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button variant="outline" size="sm" onClick={addSegment} className="bg-card">
              <Plus className="mr-1 h-4 w-4" />
              区間を追加
            </Button>
          </div>
        )}
      </div>

      {results && (
        <>
          {/* 黒地 合計カード (デザインの Taxi 計算結果ヘッダー) */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--wm-ink)", color: "#fff" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">
                  合計料金 ({results.totalDistance.toFixed(1)} km)
                </div>
                <div className="wm-num mt-1 text-[30px] font-bold leading-none tracking-tight">
                  ¥{results.totalFare.toLocaleString()}
                </div>
              </div>
              {results.mode === "same" && (
                <div className="text-right">
                  <div className="text-[11px] font-semibold tracking-[.1em] opacity-60">
                    1人あたり
                  </div>
                  <div className="wm-num mt-1 text-[22px] font-bold">
                    ¥{results.perPerson.toLocaleString()}
                    {results.remainder > 0 && (
                      <span className="text-[12px] font-medium opacity-70">
                        〜¥{(results.perPerson + 1).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* same モード: 端数の補足 */}
            {results.mode === "same" && results.remainder > 0 && (
              <div className="mt-3 rounded-[10px] bg-white/[0.06] p-2.5 text-[11px] opacity-80">
                端数調整: {results.remainder} 人が +1 円で合計 ¥{results.totalFare.toLocaleString()} に一致
              </div>
            )}

            {/* segments モード: 1 人乗車中の数 + 単価 */}
            {results.mode === "segments" && (
              <div className="mt-3.5 flex items-center justify-between text-[11px] opacity-70">
                <span>{results.totalPassengers}人乗車</span>
                <span className="wm-num">
                  距離単価 ¥{Math.round(results.pricePerKm).toLocaleString()}/km
                </span>
              </div>
            )}
          </div>

          {/* segments モード: 降りる順番タイムライン (デザインの「降りる順番」) */}
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
                        className="block w-full rounded-[12px] border border-[var(--wm-line)] bg-card px-3 py-2.5 text-left transition hover:bg-[var(--wm-surface)]/50"
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
    </div>
  )
}
