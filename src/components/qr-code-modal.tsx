// src/components/qr-code-modal.tsx
'use client'

import { Download, Printer, Share2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

interface QrCodeModalProps {
  readonly url: string
  readonly fileName: string
  readonly title?: string
  readonly description?: string
  readonly onClose: () => void
}

export function QrCodeModal({
  url,
  fileName,
  title,
  description,
  onClose
}: QrCodeModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share)

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  function getQrCanvas(): Promise<HTMLCanvasElement | null> {
    return new Promise((resolve) => {
      const svg = document.getElementById('document-qr-code')
      if (!svg) return resolve(null)

      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 1000
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)

      const img = new Image()
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8'
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(svgUrl)
        resolve(canvas)
      }
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve(null)
      }
      img.src = svgUrl
    })
  }

  const handleDownload = async () => {
    const canvas = await getQrCanvas()
    if (!canvas) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}-qrcode.png`
    link.click()

    toast({
      title: 'QR Code downloaded',
      description: 'The QR code has been saved to your device.',
      duration: 3000
    })
  }

  const handleShare = async () => {
    try {
      await navigator.share({ title: title ?? fileName, url })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast({
          title: 'Share failed',
          description: err.message,
          variant: 'destructive'
        })
      }
    }
  }

  const handlePrint = async () => {
    const canvas = await getQrCanvas()
    if (!canvas) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Allow pop-ups for this site to use Print.',
        variant: 'destructive'
      })
      return
    }

    const dataUrl = canvas.toDataURL('image/png')
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${title ?? fileName}</title></head>` +
        `<body style="margin:40px;font-family:sans-serif;text-align:center;">` +
        `<img src="${dataUrl}" style="width:300px;height:300px;" />` +
        `<p style="margin-top:16px;font-size:13px;color:#555;word-break:break-all;">${url}</p>` +
        `</body></html>`
    )
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const modalTitle = title ?? `QR Code for ${fileName}`
  const modalDescription =
    description ?? 'Scan this QR code to access the document'

  return (
    <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
      <div
        className={`bg-background rounded-lg shadow-lg p-6 max-w-md w-full transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>{modalTitle}</h2>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
          </Button>
        </div>

        <div className='flex flex-col items-center justify-center p-4 bg-white rounded-md'>
          <QRCodeSVG
            id='document-qr-code'
            value={url}
            size={250}
            level='H'
            marginSize={4}
          />
        </div>

        <p className='text-center mt-4 text-sm text-muted-foreground'>
          {modalDescription}
        </p>

        <div
          className={`grid gap-2 mt-4 ${canShare ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          <Button variant='outline' onClick={handleDownload}>
            <Download className='mr-2 h-4 w-4' />
            Download
          </Button>
          {canShare && (
            <Button variant='outline' onClick={handleShare}>
              <Share2 className='mr-2 h-4 w-4' />
              Share
            </Button>
          )}
          <Button variant='outline' onClick={handlePrint}>
            <Printer className='mr-2 h-4 w-4' />
            Print
          </Button>
        </div>
      </div>
    </div>
  )
}
