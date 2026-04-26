"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export type TableEventType = "order:created" | "order:updated" | "order:deleted" | "member:joined" | "member:left" | "payment:updated"

interface TableEvent {
  type: TableEventType
  tableId: string
  data?: unknown
  timestamp: number
}

interface UseTableEventsOptions {
  tableId: string
  token?: string
  onEvent: (event: TableEvent) => void
  fallbackInterval?: number
}

export function useTableEvents({ tableId, token, onEvent, fallbackInterval = 10000 }: UseTableEventsOptions) {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const fallbackRef = useRef<NodeJS.Timeout | null>(null)
  const onEventRef = useRef(onEvent)
  const retryCountRef = useRef(0)
  const MAX_RETRY_DELAY = 60000 // 最大60秒
  onEventRef.current = onEvent

  const startSSE = useCallback(() => {
    if (!tableId) return

    const params = new URLSearchParams()
    if (token) params.set("token", token)

    const url = `/api/tables/${tableId}/events${params.toString() ? `?${params}` : ""}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      retryCountRef.current = 0 // 接続成功時にリセット
      // Clear fallback polling if SSE is working
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current)
        fallbackRef.current = null
      }
    }

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as TableEvent
        onEventRef.current(event)
      } catch {
        // ignore parse errors (ping messages etc)
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)

      // Fallback to polling
      if (!fallbackRef.current) {
        fallbackRef.current = setInterval(() => {
          onEventRef.current({ type: "order:updated", tableId, timestamp: Date.now() })
        }, fallbackInterval)
      }

      // 指数バックオフで再接続（5s → 10s → 20s → 40s、最大60s）
      const delay = Math.min(5000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY)
      retryCountRef.current++

      setTimeout(() => {
        if (!eventSourceRef.current) {
          startSSE()
        }
      }, delay)
    }
  }, [tableId, token, fallbackInterval])

  useEffect(() => {
    startSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current)
        fallbackRef.current = null
      }
    }
  }, [startSSE])

  return { connected }
}
