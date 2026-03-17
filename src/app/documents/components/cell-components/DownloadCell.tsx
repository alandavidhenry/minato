'use client'

import { Download } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface DownloadCellProps {
  readonly name: string
}

export function DownloadCell({ name }: DownloadCellProps) {
  const { data: session } = useSession()
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!session || isDownloading) return

    setIsDownloading(true)
    try {
      const response = await fetch(
        `/api/documents/download?name=${encodeURIComponent(name)}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Download failed')
      }

      const { url } = await response.json()

      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download error:', error)
      alert(error instanceof Error ? error.message : 'Failed to download file')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={handleDownload}
      disabled={!session || isDownloading}
      title='Download'
    >
      <Download className={isDownloading ? 'animate-pulse' : ''} />
    </Button>
  )
}
