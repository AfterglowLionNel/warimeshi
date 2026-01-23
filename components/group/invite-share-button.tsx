"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { toast } from "sonner"

interface InviteShareButtonProps {
  inviteUrl: string
  tableName: string
}

export function InviteShareButton({ inviteUrl, tableName }: InviteShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    setIsSharing(true)

    const shareData = {
      title: `${tableName} - warimeshi`,
      text: `「${tableName}」に参加しませんか？`,
      url: inviteUrl,
    }

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(inviteUrl)
        toast.success("リンクをコピーしました")
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Share failed:", error)
        // Try clipboard fallback
        try {
          await navigator.clipboard.writeText(inviteUrl)
          toast.success("リンクをコピーしました")
        } catch {
          toast.error("共有に失敗しました")
        }
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Button variant="outline" size="icon" onClick={handleShare} disabled={isSharing}>
      <Share2 className="h-4 w-4" />
    </Button>
  )
}
