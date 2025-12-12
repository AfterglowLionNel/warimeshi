export interface SoloOrder {
  id: string
  itemName: string
  unitPrice: number
  quantity: number
  lineTotal: number
  createdAt: number
}

export interface SoloSession {
  name: string
  createdAt: number
  lastModified: number
  orders: SoloOrder[]
}

export type SortField = "createdAt" | "itemName" | "unitPrice" | "quantity"
export type SortDirection = "asc" | "desc"
