'use client'

import { Clock, FileIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { parseFileName } from '@/lib/version-manager'

interface DocumentNameCellProps {
  readonly name: string
  readonly type: string
  readonly hasVersions: boolean
  readonly versionNumber?: number
  readonly totalVersions?: number
  readonly originalName?: string
}

export function DocumentNameCell({
  name,
  type,
  hasVersions,
  versionNumber,
  totalVersions,
  originalName
}: DocumentNameCellProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const { baseName, extension } = parseFileName(name)
  const displayName = originalName ?? `${baseName}${extension}`

  const handleClick = async () => {
    if (!session || isLoading) return

    if (type.toLowerCase().includes('pdf')) {
      // Navigate to PDF viewer for PDF files
      router.push(`/documents/view/${encodeURIComponent(name)}`)
    } else {
      // Handle other file types with direct download
      handleDownload()
    }
  }

  const handleDownload = async () => {
    setIsLoading(true)
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
      setIsLoading(false)
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <FileIcon className='h-4 w-4' />
      <button
        onClick={handleClick}
        className='hover:underline text-blue-600 disabled:text-gray-400'
        disabled={!session || isLoading}
      >
        {isLoading ? 'Loading...' : displayName}
      </button>

      {hasVersions && versionNumber && totalVersions && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant='outline' className='flex items-center gap-1 ml-2'>
                <Clock className='h-3 w-3' />v{versionNumber}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Version {versionNumber} of {totalVersions}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
