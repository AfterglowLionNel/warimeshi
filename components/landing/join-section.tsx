"use client"

import { useState, useRef, useEffect } from "react"
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setIsScanning(true)
      scanQRCode()
    } catch (err) {
      console.error("Camera access error:", err)
      toast.error("カメラへのアクセスが許可されていません")
    }
  }

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanQRCode)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    try {
      // Use BarcodeDetector if available (Chrome, Edge)
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
        barcodeDetector.detect(canvas)
          .then((barcodes: any[]) => {
            if (barcodes.length > 0) {
              const qrData = barcodes[0].rawValue
              const token = extractToken(qrData)
              if (token) {
                stopCamera()
                setIsOpen(false)
                router.push(`/group/join/${token}`)
                return
              }
            }
            if (streamRef.current) {
              requestAnimationFrame(scanQRCode)
            }
          })
          .catch(() => {
            if (streamRef.current) {
              requestAnimationFrame(scanQRCode)
            }
          })
      } else {
        // Fallback: just keep trying (won't actually detect without a library)
        requestAnimationFrame(scanQRCode)
      }
    } catch {
      requestAnimationFrame(scanQRCode)
    }
  }

  useEffect(() => {
    if (isScanning && streamRef.current) {
      scanQRCode()
    }
  }, [isScanning])

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
                  <video
                    ref={videoRef}
                    className="w-full aspect-square object-cover rounded-lg bg-black"
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
