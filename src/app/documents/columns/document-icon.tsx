// src/app/documents/columns/document-icon.tsx
'use client'

import { Clock, FileIcon, Folder } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { toast } from '@/components/ui/use-toast'

interface DocumentIconCellProps {
  readonly item: {
    id: string
    name: string
    type: string
    path?: string
    hasVersions?: boolean
    versionNumber?: number
    totalVersions?: number
  }
}

export function DocumentIconCell({ item }: DocumentIconCellProps) {
  const router = useRouter()
  const { data: session } = useSession()

  // Handle click on folder or file
  const handleClick = () => {
    if (!session) return

    if (item.type === 'folder') {
      // Navigate to folder
      router.push(`/documents?path=${encodeURIComponent(item.path ?? '')}`)
    } else {
      // Handle file click
      if (item.type.toLowerCase().includes('pdf')) {
        // Navigate to PDF viewer
        router.push(
          `/documents/view/${encodeURIComponent(item.path ?? item.name)}`
        )
      } else {
        // Download any other file type
        downloadFile(item.path ?? item.name)
      }
    }
  }

  // Function to download file
  const downloadFile = async (fileName: string) => {
    try {
      const response = await fetch(
        `/api/documents/download?name=${encodeURIComponent(fileName)}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Download failed')
      }

      const { url } = await response.json()

      const link = document.createElement('a')
      link.href = url
      link.download = fileName.split('/').pop() ?? fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download failed',
        description:
          error instanceof Error ? error.message : 'Failed to download file',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className='flex items-center gap-2'>
      {item.type === 'folder' ? (
        <Folder className='h-4 w-4 text-blue-500' />
      ) : (
        <FileIcon className='h-4 w-4' />
      )}
      <button
        onClick={handleClick}
        className='hover:underline text-blue-600 disabled:text-gray-400'
        disabled={!session}
      >
        {item.name}
      </button>

      {item.type !== 'folder' &&
        item.hasVersions &&
        item.versionNumber &&
        item.totalVersions && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant='outline'
                  className='flex items-center gap-1 ml-2'
                >
                  <Clock className='h-3 w-3' />v{item.versionNumber}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Version {item.versionNumber} of {item.totalVersions}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
    </div>
  )
}
