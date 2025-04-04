// src/components/qr-code-modal.tsx
'use client'

import { Download, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

interface QrCodeModalProps {
  readonly url: string
  readonly fileName: string
  readonly onClose: () => void
}

export function QrCodeModal({ url, fileName, onClose }: QrCodeModalProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Small delay for animation
    setIsVisible(true)

    // Add escape key handler
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Handle QR code download
  const handleDownloadQrCode = () => {
    const svg = document.getElementById('document-qr-code')
    if (!svg) return

    // Create canvas from SVG
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size (making it larger for better quality)
    canvas.width = 1000
    canvas.height = 1000

    // Create image from SVG
    const img = new Image()
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    img.onload = () => {
      // Draw white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw QR code
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Convert to PNG and download
      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngUrl
      downloadLink.download = `${fileName.replace(/\.[^/.]+$/, '')}-qrcode.png`
      downloadLink.click()

      // Clean up
      URL.revokeObjectURL(svgUrl)

      toast({
        title: 'QR Code downloaded',
        description: 'The QR code has been saved to your device.',
        duration: 3000
      })
    }

    img.src = svgUrl
  }

  return (
    <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
      <div
        className={`bg-background rounded-lg shadow-lg p-6 max-w-md w-full transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>QR Code for {fileName}</h2>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='h-4 w-4' />
          </Button>
        </div>

        <div className='flex flex-col items-center justify-center p-4 bg-white rounded-md'>
          <QRCodeSVG
            id='document-qr-code'
            value={url}
            size={250}
            level='H' // High error correction
            marginSize={4}
          />
        </div>

        <div className='text-center mt-4 text-sm text-muted-foreground'>
          <p>Scan this QR code to access the document</p>
          <p className='mt-1'>Valid for 7 days</p>
        </div>

        <div className='flex justify-center mt-4'>
          <Button onClick={handleDownloadQrCode} className='w-full'>
            <Download className='mr-2 h-4 w-4' />
            Download QR Code
          </Button>
        </div>
      </div>
    </div>
  )
}
