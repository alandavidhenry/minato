'use client'

import { QrCode, Share2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { QrCodeModal } from '@/components/qr-code-modal'
import { ShareModal } from '@/components/share-modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { VersionUploadModal } from '@/components/version-upload-modal'
import { parseFileName } from '@/lib/version-manager'

interface ShareCellProps {
  readonly name: string
}

export function ShareCell({ name }: ShareCellProps) {
  const { data: session } = useSession()
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showQrCode, setShowQrCode] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showVersionUploadModal, setShowVersionUploadModal] = useState(false)

  // Extract original name for display and versioning
  const { baseName, extension } = parseFileName(name)
  const originalName = `${baseName}${extension}`

  const generateShareUrl = async (
    expirationDays: number = 7
  ): Promise<string> => {
    const response = await fetch(
      `/api/documents/share?name=${encodeURIComponent(name)}&expirationDays=${expirationDays}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error ?? 'Share link generation failed')
    }

    const data = await response.json()
    return data.shareUrl
  }

  const handleShare = () => {
    if (!session || isSharing) return
    setShowShareModal(true)
  }

  const handleShowQrCode = async () => {
    if (!session || isSharing) return

    setIsSharing(true)
    try {
      // Generate a new URL with default 7 days expiration for QR code
      const url = await generateShareUrl(7)
      setShareUrl(url)
      setShowQrCode(true)
    } catch (error) {
      console.error('QR code generation error:', error)
      toast({
        title: 'Failed to generate QR code',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsSharing(false)
    }
  }

  const handleShareGenerated = (url: string) => {
    setShareUrl(url)
  }

  return (
    <>
      <div className='flex space-x-1'>
        <Button
          variant='ghost'
          size='icon'
          onClick={handleShare}
          disabled={!session || isSharing}
          title='Share with custom options'
        >
          <Share2 className={isSharing ? 'animate-pulse' : ''} />
        </Button>

        <Button
          variant='ghost'
          size='icon'
          onClick={handleShowQrCode}
          disabled={!session || isSharing}
          title='Generate QR Code'
        >
          <QrCode className={isSharing ? 'animate-pulse' : ''} />
        </Button>
      </div>

      {/* QR Code Modal */}
      {showQrCode && shareUrl && (
        <QrCodeModal
          url={shareUrl}
          fileName={name}
          onClose={() => setShowQrCode(false)}
        />
      )}

      {/* Share Modal with Expiration Options and URL Shortener */}
      {showShareModal && (
        <ShareModal
          fileName={name}
          onClose={() => setShowShareModal(false)}
          onShareGenerated={handleShareGenerated}
        />
      )}

      {/* Version Upload Modal */}
      {showVersionUploadModal && (
        <VersionUploadModal
          originalFileName={originalName}
          onClose={() => setShowVersionUploadModal(false)}
          onVersionUploaded={() => window.location.reload()}
        />
      )}
    </>
  )
}
