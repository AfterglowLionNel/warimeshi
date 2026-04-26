"use client"

import { useState, useEffect, useCallback } from "react"
import type { SoloSession, SoloOrder } from "@/lib/types/solo"

const STORAGE_PREFIX = "solo-session-"

export function useSoloSession(sessionId: string) {
  const [session, setSession] = useState<SoloSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const storageKey = `${STORAGE_PREFIX}${sessionId}`

  // Load session from localStorage
  useEffect(() => {
    setIsLoading(true)
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        setSession(JSON.parse(stored))
      } else {
        // Create new session
        const newSession: SoloSession = {
          name: `セッション ${new Date().toLocaleDateString("ja-JP")}`,
          createdAt: Date.now(),
          lastModified: Date.now(),
          orders: [],
        }
        localStorage.setItem(storageKey, JSON.stringify(newSession))
        setSession(newSession)
      }
    } catch (error) {
      console.error("Failed to load session:", error)
    } finally {
      setIsLoading(false)
    }
  }, [storageKey])

  // Save session to localStorage
  const saveSession = useCallback(
    (updatedSession: SoloSession) => {
      const sessionWithTimestamp = {
        ...updatedSession,
        lastModified: Date.now(),
      }
      localStorage.setItem(storageKey, JSON.stringify(sessionWithTimestamp))
      setSession(sessionWithTimestamp)
    },
    [storageKey],
  )

  // Add order
  const addOrder = useCallback(
    (order: Omit<SoloOrder, "id" | "lineTotal" | "createdAt">) => {
      if (!session) return
      const newOrder: SoloOrder = {
        ...order,
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        lineTotal: order.unitPrice * order.quantity,
        createdAt: Date.now(),
      }
      saveSession({
        ...session,
        orders: [...session.orders, newOrder],
      })
    },
    [session, saveSession],
  )

  // Update order
  const updateOrder = useCallback(
    (orderId: string, updates: Partial<Omit<SoloOrder, "id" | "lineTotal" | "createdAt">>) => {
      if (!session) return
      const updatedOrders = session.orders.map((order) => {
        if (order.id === orderId) {
          const updated = { ...order, ...updates }
          return {
            ...updated,
            lineTotal: updated.unitPrice * updated.quantity,
          }
        }
        return order
      })
      saveSession({ ...session, orders: updatedOrders })
    },
    [session, saveSession],
  )

  // Delete order
  const deleteOrder = useCallback(
    (orderId: string) => {
      if (!session) return
      saveSession({
        ...session,
        orders: session.orders.filter((o) => o.id !== orderId),
      })
    },
    [session, saveSession],
  )

  // Clear all orders
  const clearAllOrders = useCallback(() => {
    if (!session) return
    saveSession({ ...session, orders: [] })
  }, [session, saveSession])

  // Update session name
  const updateSessionName = useCallback(
    (name: string) => {
      if (!session) return
      saveSession({ ...session, name })
    },
    [session, saveSession],
  )

  // Update memo
  const updateMemo = useCallback(
    (memo: string) => {
      if (!session) return
      saveSession({ ...session, memo })
    },
    [session, saveSession],
  )

  return {
    session,
    isLoading,
    addOrder,
    updateOrder,
    deleteOrder,
    clearAllOrders,
    updateSessionName,
    updateMemo,
  }
}

// Get all sessions from localStorage
export function getAllSoloSessions(): Array<{ id: string; session: SoloSession }> {
  if (typeof window === "undefined") return []

  const sessions: Array<{ id: string; session: SoloSession }> = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const session = JSON.parse(localStorage.getItem(key) || "")
        sessions.push({
          id: key.replace(STORAGE_PREFIX, ""),
          session,
        })
      } catch {
        // Skip invalid entries
      }
    }
  }
  return sessions.sort((a, b) => b.session.lastModified - a.session.lastModified)
}

// Delete a session
export function deleteSoloSession(sessionId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`)
}
