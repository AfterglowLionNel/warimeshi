"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { QrCode, Link2, Camera, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import jsQR from "jsqr"

export function JoinSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [inviteInput, setInviteInput] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const router = useRouter()

  const extractToken = (input: string): string | null => {
    const trimmed = input.trim()

    // Handle full URLs like https://warimeshi.com/group/join/TOKEN or /group/join/TOKEN
    const urlMatch = trimmed.match(/\/group\/join\/([a-zA-Z0-9_-]+)/)
    if (urlMatch) {
      return urlMatch[1]
    }

    // Handle table URLs like /group/table/TOKEN
    const tableMatch = trimmed.match(/\/group\/table\/([a-zA-Z0-9_-]+)/)
    if (tableMatch) {
      return tableMatch[1]
    }

    // If it looks like just a token (alphanumeric, hyphens, underscores)
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 5) {
      return trimmed
    }

    return null
  }

  const handleJoin = () => {
    const token = extractToken(inviteInput)
    if (!token) {
      toast.error("有効な招待リンクまたはコードを入力してください")
      return
    }

    setIsProcessing(true)
    setIsOpen(false)
    router.push(`/group/join/${token}`)
  }

  const stopCamera = () => {
    scanningRef.current = false
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const scanningRef = useRef(false)
  const animationRef = useRef<number | null>(null)

  const startCamera = async () => {
    try {
      // Try rear camera first, fallback to any camera
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        })
      }
      streamRef.current = stream
      scanningRef.current = true
      setIsScanning(true)
    } catch (err: unknown) {
      console.error("Camera access error:", err)
      const errorName = err instanceof Error ? err.name : ""
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        toast.error("カメラへのアクセスを許可してください。ブラウザの設定からカメラの権限を確認してください。")
      } else if (errorName === "NotFoundError") {
        toast.error("カメラが見つかりません")
      } else {
        toast.error("カメラの起動に失敗しました")
      }
    }
  }

  const scanQRCode = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { willReadFrequently: true })

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })

    if (code && code.data) {
      const token = extractToken(code.data)
      if (token) {
        stopCamera()
        setIsOpen(false)
        router.push(`/group/join/${token}`)
        return
      }
    }

    if (scanningRef.current) {
      animationRef.current = requestAnimationFrame(scanQRCode)
    }
  }, [router])

  useEffect(() => {
    if (isScanning && streamRef.current && videoRef.current) {
      const video = videoRef.current
      video.srcObject = streamRef.current
      video.play().then(() => {
        scanQRCode()
      }).catch((err) => {
        console.error("Video play error:", err)
        stopCamera()
        toast.error("カメラの映像を表示できませんでした")
      })
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isScanning, scanQRCode])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const handleDialogChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      stopCamera()
      setInviteInput("")
    }
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <div className="max-w-md mx-auto">
        <Dialog open={isOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 rounded-xl transition-colors">
              <QrCode className="h-4 w-4" />
              <span>招待リンク・QRコードで参加</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>テーブルに参加</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* QR Scanner */}
              {isScanning ? (
                <div className="relative">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={videoRef}
                    className="w-full aspect-square object-cover rounded-lg bg-black"
                    autoPlay
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={stopCamera}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-primary rounded-lg" />
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    QRコードを枠内に合わせてください
                  </p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 flex-col gap-2"
                  onClick={startCamera}
                >
                  <Camera className="h-6 w-6" />
                  <span>QRコードをスキャン</span>
                </Button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">または</span>
                </div>
              </div>

              {/* URL/Code Input */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">招待リンク・コードを入力</span>
                </div>
                <Input
                  placeholder="https://... または招待コード"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={!inviteInput.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      移動中...
                    </>
                  ) : (
                    "参加する"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
