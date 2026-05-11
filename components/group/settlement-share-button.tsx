"use client"

import { useRef, useState } from "react"
import html2canvas from "html2canvas"
import { Button } from "@/components/ui/button"
import { Share2, Copy, Check, Download } from "lucide-react"
import { toast } from "sonner"
import {
  formatEventDate,
  formatSettlement,
  type SettlementBreakdownMember,
  type SettlementEntry,
  type SettlementMemberSummary,
} from "@/lib/utils/format-settlement"

interface SettlementShareButtonProps {
  tableName: string
  eventDate?: string | null
  perPerson: number
  entries: SettlementEntry[]
  totalAmount?: number
  payerName?: string | null
  adjustmentSummary?: string | null
  memberSummaries?: (SettlementMemberSummary & { color?: string })[]
  breakdowns?: (SettlementBreakdownMember & { color?: string })[]
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 60) || "warimeshi"
}

function yen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`
}

function canUseLineUrlScheme() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua)
}

export function SettlementShareButton({
  tableName,
  eventDate,
  perPerson,
  entries,
  totalAmount,
  payerName,
  adjustmentSummary,
  memberSummaries = [],
  breakdowns = [],
}: SettlementShareButtonProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [isImageSharing, setIsImageSharing] = useState(false)
  const imageRef = useRef<HTMLDivElement | null>(null)

  if (entries.length === 0 && memberSummaries.length === 0) return null

  const eventDateLabel = formatEventDate(eventDate)
  const text = formatSettlement(tableName, perPerson, entries, {
    totalAmount,
    eventDate,
    payerName,
    adjustmentSummary,
    memberSummaries,
    breakdowns,
  })

  const copyText = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }

    try {
      await copyText()
      toast.success("内訳をコピーしました。LINEに貼り付けてください")
      if (typeof window !== "undefined" && canUseLineUrlScheme()) {
        window.location.href = `https://line.me/R/share?text=${encodeURIComponent(text)}`
      }
    } catch {
      toast.error("共有に失敗しました")
    }
  }

  const handleCopy = async () => {
    try {
      await copyText()
      setIsCopied(true)
      toast.success("割り勘結果をコピーしました")
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error("コピーに失敗しました")
    }
  }

  const handleImageShare = async () => {
    if (!imageRef.current || isImageSharing) return
    setIsImageSharing(true)

    try {
      const canvas = await html2canvas(imageRef.current, {
        scale: 2,
        backgroundColor: "#FAFAF7",
        logging: false,
        useCORS: true,
      })

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("画像の生成に失敗しました")

      const file = new File([blob], `${safeFileName(tableName)}-warikan.png`, { type: "image/png" })
      const shareData = { files: [file], text }

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        typeof navigator.canShare === "function" &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData)
        return
      }

      await copyText().catch(() => undefined)

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("画像を保存しました。テキストもコピー済みです")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      console.error("Failed to share settlement image", error)
      toast.error("画像共有に失敗しました")
    } finally {
      setIsImageSharing(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} title="LINEへテキスト共有">
          <Share2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="内訳つきでコピー">
          {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleImageShare}
          disabled={isImageSharing}
          title="画像で共有"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
        <div
          ref={imageRef}
          style={{
            width: 720,
            background: "#FAFAF7",
            color: "#1A1A1A",
            padding: 28,
            fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
          }}
        >
          <div style={{ borderRadius: 18, background: "#FFFFFF", border: "1px solid #E7E5DF", overflow: "hidden" }}>
            <div style={{ background: "#1A1A1A", color: "#FFFFFF", padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src="/icon-light-32x32.png"
                    alt=""
                    width={32}
                    height={32}
                    style={{ width: 32, height: 32, borderRadius: 8, background: "#FFFFFF" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, opacity: 0.72 }}>warimeshi</div>
                    <div style={{ marginTop: 2, fontSize: 16, fontWeight: 700 }}>割り勘結果</div>
                  </div>
                </div>
                {eventDateLabel && (
                  <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.86, textAlign: "right" }}>{eventDateLabel}</div>
                )}
              </div>
              <div style={{ marginTop: 18, fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>{tableName}</div>
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: payerName ? "1fr 1fr" : "1fr", gap: 12 }}>
                <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.1)", padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.62 }}>合計</div>
                  <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{yen(totalAmount ?? 0)}</div>
                </div>
                {payerName && (
                  <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.1)", padding: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.62 }}>会計する人</div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{payerName}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ border: "1px solid #E7E5DF", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ background: "#F2F1EC", padding: "9px 12px", fontSize: 15, fontWeight: 700 }}>各自の金額</div>
                <div style={{ padding: "0 12px" }}>
                  {memberSummaries.map((member, index) => (
                    <div
                      key={`${member.memberName}-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 150px",
                        alignItems: "center",
                        gap: 12,
                        borderBottom: index === memberSummaries.length - 1 ? "0" : "1px dashed #D6D2C8",
                        padding: "12px 0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: member.color || "#D9D6CE",
                            border: "1px solid rgba(0,0,0,0.08)",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
                          {member.memberName}
                          {member.isPayer ? "（会計する人）" : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, textAlign: "right" }}>{yen(member.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {entries.length > 0 && (
                <div style={{ marginTop: 18, border: "1px solid #E7E5DF", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ background: "#F2F1EC", padding: "9px 12px", fontSize: 15, fontWeight: 700 }}>支払い</div>
                  <div style={{ padding: "0 12px" }}>
                    {entries.map((entry, index) => (
                      <div
                        key={`${entry.memberName}-${index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 120px",
                          alignItems: "center",
                          gap: 12,
                          borderBottom: index === entries.length - 1 ? "0" : "1px dashed #D6D2C8",
                          padding: "11px 0",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ overflowWrap: "anywhere" }}>
                          {entry.isPaid ? "支払い済み  " : "未払い  "}
                          {entry.memberName}
                          {payerName ? ` → ${payerName}` : ""}
                        </span>
                        <strong style={{ fontSize: 15, textAlign: "right" }}>{yen(entry.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adjustmentSummary && (
                <div
                  style={{
                    marginTop: 18,
                    borderRadius: 12,
                    border: "1px dashed #D89380",
                    background: "#FFF4F0",
                    color: "#A93E2A",
                    padding: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.55,
                  }}
                >
                  {adjustmentSummary}
                </div>
              )}

              {breakdowns.length > 0 && (
                <div style={{ marginTop: 18, border: "1px solid #E7E5DF", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ background: "#F2F1EC", padding: "9px 12px", fontSize: 15, fontWeight: 700 }}>食べた内訳</div>
                  <div style={{ display: "grid", gap: 0 }}>
                    {breakdowns.map((member, memberIndex) => (
                      <div
                        key={`${member.memberName}-${memberIndex}`}
                        style={{
                          borderBottom: memberIndex === breakdowns.length - 1 ? "0" : "1px solid #E7E5DF",
                          padding: "0 12px 8px",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 130px",
                            alignItems: "center",
                            gap: 12,
                            padding: "11px 0 8px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: 999,
                                background: member.color || "#D9D6CE",
                                border: "1px solid rgba(0,0,0,0.08)",
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 14, fontWeight: 800, overflowWrap: "anywhere" }}>{member.memberName}</span>
                          </div>
                          <strong style={{ fontSize: 15, textAlign: "right" }}>{yen(member.totalAmount)}</strong>
                        </div>
                        {member.items.length === 0 ? (
                          <div style={{ color: "#9A9892", fontSize: 12, padding: "2px 0 6px 20px" }}>注文なし</div>
                        ) : (
                          <div style={{ borderTop: "1px dashed #D6D2C8" }}>
                            {member.items.map((item, index) => (
                              <div
                                key={`${member.memberName}-${item.itemName}-${index}`}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 110px",
                                  gap: 10,
                                  borderBottom: index === member.items.length - 1 ? "0" : "1px dashed #D6D2C8",
                                  padding: "8px 0 8px 20px",
                                  fontSize: 12,
                                }}
                              >
                                <span style={{ overflowWrap: "anywhere" }}>
                                  {item.itemName}
                                  {item.quantity > 1 ? ` x${item.quantity}` : ""}
                                </span>
                                <strong style={{ textAlign: "right" }}>{yen(item.amount)}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, color: "#9A9892", fontSize: 11, textAlign: "right" }}>warimeshiで計算しました</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
