"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TableMember } from "@/lib/types/group"

export type RouletteAdjustmentType = "remainder_roulette" | "lucky_discount" | "full_burden_roulette"

export type RouletteResult = {
  type: RouletteAdjustmentType
  targetMemberId: string
  amount?: number
}

const ROULETTE_ITEM_WIDTH = 128
const ROULETTE_DURATION_MS = 9200
const ROULETTE_LOOP_COUNT = 64

function getRouletteTravel(progress: number, totalDistance: number) {
  const brakeStart = 0.55
  const creepStart = 0.92
  const slowDistance = Math.min(totalDistance * 0.16, ROULETTE_ITEM_WIDTH * 9.5)
  const creepDistance = Math.min(totalDistance * 0.04, ROULETTE_ITEM_WIDTH * 1.1)
  const fastEnd = Math.max(0, totalDistance - slowDistance)
  const creepStartDistance = Math.max(fastEnd, totalDistance - creepDistance)

  if (progress < brakeStart) return fastEnd * (progress / brakeStart)

  if (progress < creepStart) {
    const p = (progress - brakeStart) / (creepStart - brakeStart)
    return fastEnd + (creepStartDistance - fastEnd) * (1 - Math.pow(1 - p, 2.35))
  }

  const p = (progress - creepStart) / (1 - creepStart)
  return creepStartDistance + (totalDistance - creepStartDistance) * (1 - Math.pow(1 - p, 3.9))
}

export function useFunAdjustmentRoulette({
  members,
  exemptMemberId,
  onResult,
}: {
  members: TableMember[]
  exemptMemberId: string | null
  onResult: (result: RouletteResult) => void
}) {
  const [spinningAdjustmentType, setSpinningAdjustmentType] = useState<RouletteAdjustmentType | null>(null)
  const [roulettePreviewMemberId, setRoulettePreviewMemberId] = useState<string | null>(null)
  const [roulettePreviewSlotIndex, setRoulettePreviewSlotIndex] = useState<number | null>(null)
  const [rouletteOffset, setRouletteOffset] = useState(ROULETTE_ITEM_WIDTH / 2)
  const [rouletteConfettiBurst, setRouletteConfettiBurst] = useState(false)

  const rouletteFrameRef = useRef<number | null>(null)
  const rouletteFinishTimeoutRef = useRef<number | null>(null)
  const rouletteConfettiTimeoutRef = useRef<number | null>(null)
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const rouletteCandidates = useMemo(
    () => members.filter((member) => member.id !== exemptMemberId),
    [members, exemptMemberId],
  )

  const rouletteMembers = useMemo(() => {
    if (rouletteCandidates.length === 0) return []
    return Array.from({ length: ROULETTE_LOOP_COUNT }, () => rouletteCandidates).flat()
  }, [rouletteCandidates])

  const cancelPendingTimers = useCallback(() => {
    if (rouletteFrameRef.current !== null) {
      window.cancelAnimationFrame(rouletteFrameRef.current)
      rouletteFrameRef.current = null
    }
    if (rouletteFinishTimeoutRef.current !== null) {
      window.clearTimeout(rouletteFinishTimeoutRef.current)
      rouletteFinishTimeoutRef.current = null
    }
    if (rouletteConfettiTimeoutRef.current !== null) {
      window.clearTimeout(rouletteConfettiTimeoutRef.current)
      rouletteConfettiTimeoutRef.current = null
    }
  }, [])

  const runRandomFunAdjustment = useCallback(
    (type: RouletteAdjustmentType) => {
      if (rouletteCandidates.length === 0 || spinningAdjustmentType) return

      cancelPendingTimers()

      const targetIndex = Math.floor(Math.random() * rouletteCandidates.length)
      const targetMember = rouletteCandidates[targetIndex]
      if (!targetMember) return

      const startOffset = ROULETTE_ITEM_WIDTH / 2
      const targetLoop = Math.max(4, ROULETTE_LOOP_COUNT - 2)
      const targetSlotIndex = targetLoop * rouletteCandidates.length + targetIndex
      const endOffset = targetSlotIndex * ROULETTE_ITEM_WIDTH + ROULETTE_ITEM_WIDTH / 2
      const totalDistance = endOffset - startOffset
      let startedAt: number | null = null

      setSpinningAdjustmentType(type)
      setRouletteOffset(startOffset)
      setRouletteConfettiBurst(false)
      setRoulettePreviewMemberId(rouletteCandidates[0]?.id ?? null)
      setRoulettePreviewSlotIndex(0)

      const animate = (timestamp: number) => {
        if (startedAt === null) startedAt = timestamp
        const progress = Math.min(1, (timestamp - startedAt) / ROULETTE_DURATION_MS)
        const nextOffset = startOffset + getRouletteTravel(progress, totalDistance)
        const centeredSlotIndex = Math.max(
          0,
          Math.round((nextOffset - ROULETTE_ITEM_WIDTH / 2) / ROULETTE_ITEM_WIDTH),
        )
        const previewMember = rouletteCandidates[centeredSlotIndex % rouletteCandidates.length]

        setRouletteOffset(nextOffset)
        setRoulettePreviewSlotIndex(centeredSlotIndex)
        if (previewMember) setRoulettePreviewMemberId(previewMember.id)

        if (progress < 1) {
          rouletteFrameRef.current = window.requestAnimationFrame(animate)
          return
        }

        setRouletteOffset(endOffset)
        setRoulettePreviewMemberId(targetMember.id)
        setRoulettePreviewSlotIndex(targetSlotIndex)
        onResultRef.current({
          type,
          targetMemberId: targetMember.id,
          amount: type === "lucky_discount" ? 500 : undefined,
        })
        rouletteFrameRef.current = null
        rouletteFinishTimeoutRef.current = window.setTimeout(() => {
          setRoulettePreviewMemberId(null)
          setRoulettePreviewSlotIndex(null)
          setSpinningAdjustmentType(null)
          setRouletteConfettiBurst(true)
          rouletteFinishTimeoutRef.current = null
          rouletteConfettiTimeoutRef.current = window.setTimeout(() => {
            setRouletteConfettiBurst(false)
            rouletteConfettiTimeoutRef.current = null
          }, 1900)
        }, 900)
      }

      rouletteFrameRef.current = window.requestAnimationFrame(animate)
    },
    [cancelPendingTimers, rouletteCandidates, spinningAdjustmentType],
  )

  useEffect(() => cancelPendingTimers, [cancelPendingTimers])

  return {
    spinningAdjustmentType,
    roulettePreviewMemberId,
    roulettePreviewSlotIndex,
    rouletteOffset,
    rouletteConfettiBurst,
    rouletteCandidates,
    rouletteMembers,
    runRandomFunAdjustment,
  }
}
