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
}

export type CalculationMode = "same" | "segments"
