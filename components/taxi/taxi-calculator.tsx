"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Calculator, Car, Plus, Trash2, Truck, Users } from "lucide-react"
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
}

export function TaxiCalculator({
  showBackLink = true,
  backLinkHref = "/",
  backLinkText = "トップに戻る",
  tableId,
  currentUserId,
}: TaxiCalculatorProps) {
  const supabase = createClient()

  const [vehicleType, setVehicleType] = useState<VehicleType>("taxi")
  const [taxiSettings, setTaxiSettings] = useState<FareSettings>(DEFAULT_TAXI_SETTINGS)
  const [daikoSettings, setDaikoSettings] = useState<FareSettings>(DEFAULT_DAIKO_SETTINGS)
  const settings = vehicleType === "taxi" ? taxiSettings : daikoSettings
  const setSettings = vehicleType === "taxi" ? setTaxiSettings : setDaikoSettings

  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [mode, setMode] = useState<CalculationMode>("same")
  const [sameDistance, setSameDistance] = useState("")
  const [samePersonCount, setSamePersonCount] = useState("1")
  const [segments, setSegments] = useState<Segment[]>([{ id: "1", name: "", distanceKm: 0 }])
  const [isSaving, setIsSaving] = useState(false)
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
      setSegments(input.segments ?? [{ id: "1", name: "", distanceKm: 0 }])
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
    const { data, error } = await supabase
      .from("taxi_records")
      .select("*")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return
    if (lastRemoteCreatedAt.current && data.created_at <= lastRemoteCreatedAt.current) return
    applyRecord(data)
  }

  useEffect(() => {
    void fetchLatestRecord()
  }, [supabase, tableId])

  // Subscribe to realtime changes for instant reflection
  useEffect(() => {
    if (!tableId) return
    const channel = supabase
      .channel(`taxi-records-${tableId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "taxi_records", filter: `table_id=eq.${tableId}` },
        (payload: any) => {
          if (payload.new) applyRecord(payload.new)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, tableId])

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

  const addSegment = () => setSegments((prev) => [...prev, { id: Date.now().toString(), name: "", distanceKm: 0 }])
  const updateSegment = (id: string, updates: Partial<Segment>) =>
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  const removeSegment = (id: string) => segments.length > 1 && setSegments((prev) => prev.filter((s) => s.id !== id))

  const settingsInvalid =
    [settings.baseKm, settings.basePrice, settings.perKmPrice, settings.pickupFee].some(
      (v) => v === undefined || Number.isNaN(v) || v < 0,
    ) ||
    (vehicleType === "daiko" &&
      (settings.extraFromKm === undefined ||
        Number.isNaN(settings.extraFromKm) ||
        settings.extraFromKm < 0 ||
        settings.extraPerKm === undefined ||
        Number.isNaN(settings.extraPerKm) ||
        settings.extraPerKm < 0))

  const calculateBaseFare = (distanceKm: number) => {
    if (distanceKm <= 0) return 0
    let fare = (settings.basePrice || 0) + (settings.pickupFee || 0)
    if (distanceKm > (settings.baseKm || 0)) {
      const remainingKm = distanceKm - (settings.baseKm || 0)
      if (vehicleType === "daiko" && settings.extraFromKm && settings.extraPerKm && distanceKm > settings.extraFromKm) {
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
      const adjustment = mod.type === "fixed" ? mod.amount : baseFare * (mod.amount / 100)
      fare = mod.direction === "add" ? fare + adjustment : fare - adjustment
    }
    return Math.max(0, fare)
  }

  const results = useMemo<
    | { mode: "same"; totalDistance: number; totalFare: number; perPerson: number; personCount: number }
    | {
        mode: "segments"
        totalDistance: number
        totalFare: number
        pricePerKm: number
        segments: SegmentShareResult[]
        passengers: PassengerShare[]
      }
    | null
  >(() => {
    if (settingsInvalid) return null
    if (mode === "same") {
      const distance = Number.parseFloat(sameDistance) || 0
      const personCount = Number.parseInt(samePersonCount, 10) || 1
      if (distance <= 0 || personCount <= 0) return null
      const baseFare = calculateBaseFare(distance)
      const totalFare = applyModifiers(baseFare)
      const perPerson = Math.round(totalFare / personCount)
      return { mode: "same" as const, totalDistance: distance, totalFare, perPerson, personCount }
    }
    const validSegments = segments.filter((s) => s.distanceKm > 0)
    if (validSegments.length === 0) return null
    const totalDistance = validSegments.reduce((sum, s) => sum + s.distanceKm, 0)
    if (totalDistance <= 0) return null

    const baseFare = calculateBaseFare(totalDistance)
    const totalFare = applyModifiers(baseFare)
    const pricePerKm = totalFare / totalDistance
    const passengerTotals = new Array<number>(validSegments.length).fill(0)

    const segmentResults: SegmentShareResult[] = validSegments.map((s, idx) => {
      const segmentFareRaw = s.distanceKm * pricePerKm
      const riderCount = validSegments.length - idx
      const perPersonShareRaw = riderCount > 0 ? segmentFareRaw / riderCount : 0

      for (let i = idx; i < validSegments.length; i++) {
        passengerTotals[i] += perPersonShareRaw
      }

      return {
        ...s,
        riderCount,
        segmentFare: Math.round(segmentFareRaw),
        perPersonShare: Math.round(perPersonShareRaw),
      }
    })

    const passengers: PassengerShare[] = validSegments.map((s, idx) => ({
      id: s.id,
      name: s.name || `降車 ${idx + 1}`,
      amount: Math.round(passengerTotals[idx]),
    }))

    return { mode: "segments" as const, totalDistance, totalFare, pricePerKm, segments: segmentResults, passengers }
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
      const { error, data } = await supabase
        .from("taxi_records")
        .insert({
          table_id: tableId,
          created_by_user_id: currentUserId,
          vehicle_type: vehicleType,
          mode,
          settings,
          input: { sameDistance, samePersonCount, segments, mode, vehicleType },
          result: results,
        })
        .select("*")
        .single()
      setIsSaving(false)
      if (error) {
        console.error("Failed to save taxi record:", error)
        toast.error("保存に失敗しました")
        lastSavedHash.current = null
      } else {
        lastSavedHash.current = payloadHash
        if (data?.created_at) lastRemoteCreatedAt.current = data.created_at
      }
    }

    void save()
  }, [results, tableId, currentUserId, vehicleType, mode, settings, sameDistance, samePersonCount, segments, supabase])

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

                {vehicleType === "daiko" && (
                  <>
                    <div>
                      <Label className="text-sm">長距離閾値 (km)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={Number.isNaN(settings.extraFromKm ?? Number.NaN) ? "" : settings.extraFromKm}
                        onChange={(e) => updateSetting("extraFromKm", e.target.value, Number.parseFloat)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">追加単価 (/km)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={Number.isNaN(settings.extraPerKm ?? Number.NaN) ? "" : settings.extraPerKm}
                        onChange={(e) => updateSetting("extraPerKm", e.target.value, Number.parseInt)}
                      />
                    </div>
                  </>
                )}
              </div>
              {settingsInvalid && <p className="text-sm text-destructive">0以上の値をすべて入力してください。</p>}
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
          ) : (
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
          )}
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
              <p className="text-sm text-muted-foreground">
                出発から降車順に区間距離を入力してください。各区間の料金を、その区間に乗っている人数で割ります。
              </p>
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
                      className="w-24 h-9"
                      value={seg.distanceKm || ""}
                      onChange={(e) =>
                        updateSegment(seg.id, { distanceKm: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) })
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
                <p className="text-3xl font-bold text-primary">{formatCurrency(results.perPerson)}</p>
              </div>
            )}

            {results.mode === "segments" && (
              <div className="border-t pt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">区間ごとの内訳</h4>
                    <span className="text-xs text-muted-foreground">1kmあたり {formatCurrency(Math.round(results.pricePerKm))}</span>
                  </div>
                  <div className="space-y-2">
                    {results.segments.map((seg, index) => (
                      <div key={seg.id} className="p-2 bg-muted/50 rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{seg.name || `区間 ${index + 1}`}</span>
                            <span className="text-xs text-muted-foreground ml-2">({seg.distanceKm.toFixed(1)} km)</span>
                          </div>
                          <span className="font-bold text-primary">
                            {formatCurrency(results.passengers[index]?.amount ?? 0)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          区間料金 {formatCurrency(seg.segmentFare)} / {seg.riderCount}人乗車 / 1人あたり{formatCurrency(seg.perPersonShare)}
                        </p>
                      </div>
                    ))}
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
