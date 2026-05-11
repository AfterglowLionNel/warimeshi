import "server-only"

import { EventEmitter } from "events"

export type TableEventType = "order:created" | "order:updated" | "order:deleted" | "member:joined" | "member:left" | "payment:updated"

export interface TableEvent {
  type: TableEventType
  tableId: string
  data?: unknown
  timestamp: number
}

class TableEventEmitter extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100)
  }

  emitTableEvent(tableId: string, type: TableEventType, data?: unknown) {
    const event: TableEvent = {
      type,
      tableId,
      data,
      timestamp: Date.now(),
    }
    this.emit(`table:${tableId}`, event)
  }

  subscribeToTable(tableId: string, listener: (event: TableEvent) => void) {
    this.on(`table:${tableId}`, listener)
    return () => {
      this.off(`table:${tableId}`, listener)
    }
  }
}

// Singleton instance
const globalForEvents = globalThis as unknown as { tableEvents?: TableEventEmitter }

export const tableEvents = globalForEvents.tableEvents ?? new TableEventEmitter()

if (process.env.NODE_ENV !== "production") {
  globalForEvents.tableEvents = tableEvents
}
