"use client"

import { useRef, useState, type ReactNode } from "react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PdfCaptureProps {
  children: ReactNode
  fileName?: string
  buttonLabel?: string
  className?: string
  contentClassName?: string
  onBeforeCapture?: () => boolean | Promise<boolean>
  onAfterCapture?: () => void
}

/**
 * 表示中の UI をそのまま PDF に保存するラッパー。
 * - hidden の別ビューは使わず、いま描画されている DOM をキャプチャ
 * - 縦長になっても自動で複数ページに分割
 * - キャプチャ中だけ html に `pdf-capture-safe` を付与して、色を rgb/hex に強制する
 */
export function PdfCapture({
  children,
  fileName = "warimeshi.pdf",
  buttonLabel = "この表示をPDF保存",
  className = "space-y-3",
  contentClassName = "space-y-4",
  onBeforeCapture,
  onAfterCapture,
}: PdfCaptureProps) {
  const targetRef = useRef<HTMLDivElement | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const copyComputedStyles = (source: HTMLElement, target: HTMLElement) => {
    const computed = window.getComputedStyle(source)
    for (const prop of computed) {
      if (prop.startsWith("--")) continue
      target.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop))
    }
    const sourceChildren = Array.from(source.children) as HTMLElement[]
    const targetChildren = Array.from(target.children) as HTMLElement[]
    for (let i = 0; i < sourceChildren.length; i += 1) {
      if (targetChildren[i]) copyComputedStyles(sourceChildren[i], targetChildren[i])
    }
  }

  const handleExport = async () => {
    if (isExporting) return
    if (onBeforeCapture) {
      const proceed = await onBeforeCapture()
      if (proceed === false) return
      // レンダリング更新待ち
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    if (!targetRef.current) return

    const targetId = `pdf-capture-${Date.now()}`
    targetRef.current.setAttribute("data-pdf-capture-id", targetId)
    document.documentElement.classList.add("pdf-capture-safe")
    setIsExporting(true)

    try {
      const element = targetRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        scrollY: -window.scrollY,
        useCORS: true,
        onclone: (doc) => {
          // スタイルシートを無効化
          doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.parentNode?.removeChild(node))
          const cloned = doc.querySelector<HTMLElement>(`[data-pdf-capture-id="${targetId}"]`)
          if (cloned && element) {
            copyComputedStyles(element, cloned)
          }
        },
      })

      const pdf = new jsPDF("p", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const pageHeightPx = (pdfHeight * canvas.width) / imgWidth

      let renderedHeight = 0
      while (renderedHeight < canvas.height) {
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = canvas.width
        pageCanvas.height = Math.min(Math.floor(pageHeightPx), canvas.height - renderedHeight)

        const ctx = pageCanvas.getContext("2d")
        if (!ctx) break

        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          pageCanvas.height,
          0,
          0,
          canvas.width,
          pageCanvas.height,
        )

        const pageData = pageCanvas.toDataURL("image/png")
        const pageDrawHeight = (pageCanvas.height * imgWidth) / canvas.width
        pdf.addImage(pageData, "PNG", 0, 0, imgWidth, pageDrawHeight)

        renderedHeight += pageHeightPx
        if (renderedHeight < canvas.height) {
          pdf.addPage()
        }
      }

      pdf.save(fileName)
    } catch (error) {
      console.error("PDF 出力時にエラーが発生しました:", error)
    } finally {
      targetRef.current?.removeAttribute("data-pdf-capture-id")
      document.documentElement.classList.remove("pdf-capture-safe")
      onAfterCapture?.()
      setIsExporting(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "生成中..." : buttonLabel}
        </Button>
      </div>
      <div ref={targetRef} className={contentClassName}>
        {children}
      </div>
    </div>
  )
}
