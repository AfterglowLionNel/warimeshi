"use client"

import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"

interface InviteQRCodeProps {
  inviteUrl: string
  tableName: string
}

export function InviteQRCode({ inviteUrl, tableName }: InviteQRCodeProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QRコードで招待</DialogTitle>
          <DialogDescription>
            このQRコードをスキャンして「{tableName}」に参加できます
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-6">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={inviteUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          カメラアプリやQRコードリーダーでスキャンしてください
        </p>
      </DialogContent>
    </Dialog>
  )
}
