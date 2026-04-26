"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { formatSettlement, type SettlementEntry } from "@/lib/utils/format-settlement"

interface SettlementShareButtonProps {
  tableName: string
  perPerson: number
  entries: SettlementEntry[]
}

export function SettlementShareButton({ tableName, perPerson, entries }: SettlementShareButtonProps) {
  const [isCopied, setIsCopied] = useState(false)

  if (entries.length === 0) return null

  const text = formatSettlement(tableName, perPerson, entries)

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // User cancelled or not supported
      }
    }

    const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`
    if (typeof window !== "undefined") {
      window.open(lineUrl, "_blank", "noopener,noreferrer")
    }
  }

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setIsCopied(true)
      toast.success("割り勘結果をコピーしました")
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error("コピーに失敗しました")
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleShare} title="共有">
        <Share2 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy} title="コピー">
        {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}
