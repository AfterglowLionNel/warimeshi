"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  showBackLink = true,
  backLinkHref = "/",
  backLinkText = "トップに戻る",
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
  const [isSaving, setIsSaving] = useState(false)
  const [showLongDistanceSettings, setShowLongDistanceSettings] = useState(vehicleType === "daiko")
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set())
  const lastSavedHash = useRef<string | null>(null)
  const lastRemoteCreatedAt = useRef<string | null>(null)

  const applyRecord = (data: any) => {
    const savedSettings = (data.settings || {}) as FareSettings
    if (data.vehicle_type === "daiko") {
      setVehicleType("daiko")
      setDaikoSettings({ ...DEFAULT_DAIKO_SETTINGS, ...savedSettings })
    } else {
      setVehicleType("taxi")
      setTaxiSettings({ ...DEFAULT_TAXI_SETTINGS, ...savedSettings })
    }
    if (data.input) {
      const input = data.input as any
      setSameDistance(input.sameDistance ?? "")
      setSamePersonCount(input.samePersonCount ?? "1")
      // 後方互換: dropCountがないセグメントにはデフォルト1を設定
      const savedSegments = (input.segments ?? [{ id: "1", name: "", distanceKm: 0, dropCount: 1 }]) as Segment[]
      setSegments(savedSegments.map((s: Segment) => ({ ...s, dropCount: s.dropCount ?? 1 })))
      setMode(input.mode ?? "same")
    }
    if (data.created_at) {
      lastRemoteCreatedAt.current = data.created_at
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
  }

  const fetchLatestRecord = async () => {
    if (!tableId) return
    const res = await fetch(`/api/taxi-records?tableId=${tableId}`)
    if (!res.ok) return
    const json = (await res.json()) as { data?: any }
    const data = json.data
    if (!data) return
    if (lastRemoteCreatedAt.current && data.created_at <= lastRemoteCreatedAt.current) return
    applyRecord(data)
  }

  useEffect(() => {
    void fetchLatestRecord()
    const interval = setInterval(fetchLatestRecord, 5000)
    return () => clearInterval(interval)
  }, [tableId])

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

  const calculateBaseFare = (distanceKm: number) => {
    if (distanceKm <= 0) return 0
    let fare = (settings.basePrice || 0) + (settings.pickupFee || 0)
    if (distanceKm > (settings.baseKm || 0)) {
      const remainingKm = distanceKm - (settings.baseKm || 0)
      // Apply long-distance tier if settings exist (unified for both taxi and daiko)
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
      // %の丸めは切り捨て（1円未満切り捨て）
      const adjustment = mod.type === "fixed" ? mod.amount : Math.floor(baseFare * (mod.amount / 100))
      fare = mod.direction === "add" ? fare + adjustment : fare - adjustment
    }
    return Math.max(0, Math.round(fare))
  }

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
      <Tabs value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
        <TabsList className="w-full">
          <TabsTrigger value="taxi" className="flex-1">
            <Car className="h-4 w-4 mr-2" />
            タクシー
          </TabsTrigger>
          <TabsTrigger value="daiko" className="flex-1">
            <Truck className="h-4 w-4 mr-2" />
            運転代行
          </TabsTrigger>
        </TabsList>

        <TabsContent value={vehicleType} className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">料金設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">初乗り距離 (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={Number.isNaN(settings.baseKm) ? "" : settings.baseKm}
                    onChange={(e) => updateSetting("baseKm", e.target.value, Number.parseFloat)}
                  />
                </div>
                <div>
                  <Label className="text-sm">初乗り料金</Label>
                  <Input
                    type="number"
                    min="0"
                    value={Number.isNaN(settings.basePrice) ? "" : settings.basePrice}
                    onChange={(e) => updateSetting("basePrice", e.target.value, Number.parseInt)}
                  />
                </div>
                <div>
                  <Label className="text-sm">加算距離単価 (/km)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={Number.isNaN(settings.perKmPrice) ? "" : settings.perKmPrice}
                    onChange={(e) => updateSetting("perKmPrice", e.target.value, Number.parseInt)}
                  />
                </div>
                <div>
                  <Label className="text-sm">迎車料金</Label>
                  <Input
                    type="number"
                    min="0"
                    value={Number.isNaN(settings.pickupFee) ? "" : settings.pickupFee}
                    onChange={(e) => updateSetting("pickupFee", e.target.value, Number.parseInt)}
                  />
                </div>
              </div>

              <Collapsible open={showLongDistanceSettings} onOpenChange={setShowLongDistanceSettings}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    長距離割増設定
                    <ChevronDown className={`h-4 w-4 transition-transform ${showLongDistanceSettings ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="text-sm">長距離閾値 (km)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder={vehicleType === "daiko" ? "10" : "未設定"}
                        value={Number.isNaN(settings.extraFromKm ?? Number.NaN) ? "" : settings.extraFromKm}
                        onChange={(e) => updateSetting("extraFromKm", e.target.value, Number.parseFloat)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">追加単価 (/km)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder={vehicleType === "daiko" ? "100" : "未設定"}
                        value={Number.isNaN(settings.extraPerKm ?? Number.NaN) ? "" : settings.extraPerKm}
                        onChange={(e) => updateSetting("extraPerKm", e.target.value, Number.parseInt)}
                      />
                    </div>
                    <p className="col-span-2 text-xs text-muted-foreground">
                      設定した距離を超えると、追加単価が加算単価に上乗せされます
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {settingsInvalid && (
                <p className="text-sm text-destructive">
                  {(settings.baseKm === undefined || Number.isNaN(settings.baseKm) || settings.baseKm <= 0)
                    ? "初乗り距離は0より大きい値を入力してください。"
                    : hasLongDistance && settings.extraFromKm !== undefined && !Number.isNaN(settings.extraFromKm) && settings.extraFromKm < (settings.baseKm || 0)
                    ? "長距離閾値は初乗り距離以上に設定してください。"
                    : "0以上の値をすべて入力してください。"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">割増・割引オプション</CardTitle>
            <Button variant="outline" size="sm" onClick={addModifier}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modifiers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">オプションはありません</p>
          ) : (<>
            <p className="text-xs text-muted-foreground mb-2">※ %は基本運賃（距離料金+迎車料金）に対して適用されます（切り捨て）</p>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            距離入力
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as CalculationMode)}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="same" className="flex-1">
                全員同じ距離
              </TabsTrigger>
              <TabsTrigger value="segments" className="flex-1">
                区間別
              </TabsTrigger>
            </TabsList>

            <TabsContent value="same" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">距離 (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="5.0"
                    value={sameDistance}
                    onChange={(e) => setSameDistance(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm">人数</Label>
                  <Input type="number" min="1" value={samePersonCount} onChange={(e) => setSamePersonCount(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="segments" className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">入力方法</p>
                <p className="text-sm text-muted-foreground">
                  降車順に、各区間の距離と降車人数を入力してください。
                </p>
                <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                  <p className="font-medium mb-1">例: A→B→Cの順に降りる（Bは2人同時）</p>
                  <p>「A降車: 3km / 1人」→「B降車: 2km / 2人」→「C降車: 1km / 1人」</p>
                  <p className="mt-1">距離料金は乗車中の人数で按分、迎車料金は全員で均等分割されます。</p>
                </div>
              </div>
              <div className="space-y-2">
                {segments.map((seg, index) => (
                  <div key={seg.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                    <Input
                      placeholder="降りる人・地点"
                      className="flex-1 h-9"
                      value={seg.name}
                      onChange={(e) => updateSegment(seg.id, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="km"
                      className="w-20 h-9"
                      value={seg.distanceKm || ""}
                      onChange={(e) =>
                        updateSegment(seg.id, { distanceKm: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="人"
                      className="w-16 h-9"
                      value={seg.dropCount || 1}
                      onChange={(e) =>
                        updateSegment(seg.id, { dropCount: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => removeSegment(seg.id)}
                      disabled={segments.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addSegment}>
                <Plus className="h-4 w-4 mr-1" />
                区間を追加
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {results && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary">計算結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">合計距離</p>
                <p className="text-2xl font-bold">{results.totalDistance.toFixed(1)} km</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">合計料金</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(results.totalFare)}</p>
              </div>
            </div>

            {results.mode === "same" && (
              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{results.personCount}人で割り勘</p>
                </div>
                <p className="text-sm text-muted-foreground">一人あたり</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(results.perPerson)}
                  {results.remainder > 0 && (
                    <span className="text-base font-normal text-muted-foreground ml-1">
                      〜{formatCurrency(results.perPerson + 1)}
                    </span>
                  )}
                </p>
                {results.remainder > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    端数調整: {results.remainder}人が+1円（合計{formatCurrency(results.totalFare)}に一致）
                  </p>
                )}
              </div>
            )}

            {results.mode === "segments" && (
              <div className="border-t pt-4 space-y-4">
                {(settings.pickupFee || 0) > 0 && (
                  <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                    迎車料金 {formatCurrency(settings.pickupFee)} → {results.totalPassengers}人で均等分割（1人あたり{formatCurrency(results.pickupPerPerson)}）
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">区間ごとの内訳</h4>
                    <span className="text-xs text-muted-foreground">
                      {results.totalPassengers}人乗車 / 距離単価 {formatCurrency(Math.round(results.pricePerKm))}/km
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">タップで計算式を表示</p>
                  <div className="space-y-2">
                    {results.segments.map((seg, index) => {
                      const isExpanded = expandedSegments.has(seg.id)
                      const toggleExpand = () => {
                        setExpandedSegments(prev => {
                          const next = new Set(prev)
                          if (next.has(seg.id)) {
                            next.delete(seg.id)
                          } else {
                            next.add(seg.id)
                          }
                          return next
                        })
                      }
                      return (
                        <div
                          key={seg.id}
                          className="p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={toggleExpand}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{seg.name || `降車 ${index + 1}`}</span>
                              <span className="text-xs text-muted-foreground ml-2">({seg.distanceKm.toFixed(1)} km)</span>
                              {(results.passengers[index]?.count ?? 1) > 1 && (
                                <span className="text-xs text-muted-foreground ml-1">×{results.passengers[index].count}人</span>
                              )}
                            </div>
                            <span className="font-bold text-primary">
                              {formatCurrency(results.passengers[index]?.amount ?? 0)}
                              <span className="text-xs font-normal text-muted-foreground">/人</span>
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            区間料金 {formatCurrency(seg.segmentFare)} / {seg.riderCount}人乗車 / 1人あたり{formatCurrency(seg.perPersonShare)}
                          </p>
                          {isExpanded && (
                            <div className="mt-2 p-2 bg-background rounded text-xs space-y-1 border">
                              <p className="font-medium text-foreground">計算式:</p>
                              <p className="text-muted-foreground">
                                区間料金 = 距離 × km単価（距離按分）
                              </p>
                              <p className="font-mono text-foreground">
                                = {seg.distanceKm.toFixed(1)} km × {formatCurrency(Math.round(results.pricePerKm))}/km = {formatCurrency(seg.segmentFare)}
                              </p>
                              <p className="text-muted-foreground mt-1">
                                距離按分の1人あたり = 区間料金 ÷ 乗車人数
                              </p>
                              <p className="font-mono text-foreground">
                                = {formatCurrency(seg.segmentFare)} ÷ {seg.riderCount}人 = {formatCurrency(seg.perPersonShare)}
                              </p>
                              {results.pickupPerPerson > 0 && (
                                <>
                                  <p className="text-muted-foreground mt-1">
                                    + 迎車料金（均等分割）= {formatCurrency(results.pickupPerPerson)}/人
                                  </p>
                                </>
                              )}
                              <p className="text-muted-foreground mt-1 pt-1 border-t">
                                この地点で降りる人の支払い（1人あたり）:
                              </p>
                              <p className="font-mono text-foreground">
                                = 距離累積{results.pickupPerPerson > 0 ? " + 迎車" : ""} = {formatCurrency(results.passengers[index]?.amount ?? 0)}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>支払合計（{results.totalPassengers}人）</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(results.passengers.reduce((sum, p) => sum + p.amount * p.count, 0))}
                      {results.passengers.reduce((sum, p) => sum + p.amount * p.count, 0) === results.totalFare && (
                        <span className="text-green-600 ml-1">✓一致</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
