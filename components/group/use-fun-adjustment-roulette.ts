"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type RouletteAdjustmentType = "remainder_roulette" | "lucky_discount" | "full_burden_roulette"

export type RouletteResult = {
  type: RouletteAdjustmentType
  targetMemberId: string
  amount?: number
}

// このフックが必要とする最小限のメンバー情報。
// グループモードの TableMember と /calc の Person 両方を受け付ける。
export type RouletteMemberLike = {
  id: string
  display_name: string
}

const ROULETTE_ITEM_WIDTH = 128
const ROULETTE_DURATION_MS = 5200
const ROULETTE_LOOP_COUNT = 64
// オーバーシュート (1個分行き過ぎてバウンスバック) 演出を起こす確率
const ROULETTE_OVERSHOOT_CHANCE = 0.22

function getRouletteTravel(progress: number, totalDistance: number, overshoot: boolean) {
  // フェーズ1: 高速 (0 → 0.55): 線形に近い加速で大半の距離を進む
  const fastEnd = 0.55
  const fastTravel = totalDistance * 0.78

  if (progress <= fastEnd) {
    return fastTravel * (progress / fastEnd)
  }

  // オーバーシュートなしの場合: 0.55 → 1.0 でターゲットに緩やかに着地 (cubic ease-out)
  if (!overshoot) {
    const p = (progress - fastEnd) / (1 - fastEnd)
    const eased = 1 - Math.pow(1 - p, 3)
    return fastTravel + (totalDistance - fastTravel) * eased
  }

  // オーバーシュート版: 0.55 → 0.86 でターゲットを 1 個ぶん通り越す、0.86 → 1.0 でバウンスバック
  const overshootPeak = totalDistance + ROULETTE_ITEM_WIDTH
  const peakProgress = 0.86
  if (progress <= peakProgress) {
    const p = (progress - fastEnd) / (peakProgress - fastEnd)
    const eased = 1 - Math.pow(1 - p, 3)
    return fastTravel + (overshootPeak - fastTravel) * eased
  }
  const p = (progress - peakProgress) / (1 - peakProgress)
  const eased = 1 - Math.pow(1 - p, 2)
  return overshootPeak + (totalDistance - overshootPeak) * eased
}

export function useFunAdjustmentRoulette<M extends RouletteMemberLike>({
  members,
  exemptMemberId,
  onResult,
}: {
  members: M[]
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
      const overshoot = Math.random() < ROULETTE_OVERSHOOT_CHANCE
      let startedAt: number | null = null

      setSpinningAdjustmentType(type)
      setRouletteOffset(startOffset)
      setRouletteConfettiBurst(false)
      setRoulettePreviewMemberId(rouletteCandidates[0]?.id ?? null)
      setRoulettePreviewSlotIndex(0)

      const animate = (timestamp: number) => {
        if (startedAt === null) startedAt = timestamp
        const progress = Math.min(1, (timestamp - startedAt) / ROULETTE_DURATION_MS)
        const nextOffset = startOffset + getRouletteTravel(progress, totalDistance, overshoot)
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
