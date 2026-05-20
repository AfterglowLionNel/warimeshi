export type VehicleType = "taxi" | "daiko"

export interface FareSettings {
  baseKm: number
  basePrice: number
  perKmPrice: number
  extraFromKm?: number
  extraPerKm?: number
  pickupFee: number
}

export interface Modifier {
  id: string
  name: string
  amount: number
  type: "fixed" | "percent"
  direction: "add" | "subtract"
  enabled: boolean
}

export interface Segment {
  id: string
  name: string
  distanceKm: number
  dropCount: number  // この区間で降りる人数
}

export type CalculationMode = "total" | "same" | "segments"

// 区間別モード内での入力方式
// - fare: メーター総額を直接入力 → 距離比で按分
// - distance: 距離 + 料金設定から計算 (旧来の方式)
export type SegmentInputMode = "fare" | "distance"
