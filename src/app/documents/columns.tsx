// src/app/documents/columns.tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Clock, Download, FileIcon, QrCode, Share2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { DeleteConfirmationModal } from '@/components/delete-confirmation-modal'
import { QrCodeModal } from '@/components/qr-code-modal'
import { ShareModal } from '@/components/share-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SortArrows } from '@/components/ui/data-table/sort-arrows'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { toast } from '@/components/ui/use-toast'
import { VersionUploadModal } from '@/components/version-upload-modal'
import { parseFileName } from '@/lib/version-manager'

export type Document = {
  id: string
  name: string
  uploadedAt: string
  type: string
  size: string
  hasVersions: boolean
  versionNumber?: number
  totalVersions?: number
  originalName?: string
}

function DocumentNameCell({
  name,
  type,
  hasVersions,
  versionNumber,
  totalVersions,
  originalName
}: {
  readonly name: string
  readonly type: string
  readonly hasVersions: boolean
  readonly versionNumber?: number
  readonly totalVersions?: number
  readonly originalName?: string
}) {
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
        throw new Error(errorData.error || 'Download failed')
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

function DownloadCell({ name }: { readonly name: string }) {
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
        throw new Error(errorData.error || 'Download failed')
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

function ShareCell({ name }: { readonly name: string }) {
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
      throw new Error(errorData.error || 'Share link generation failed')
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

function VersionCell({
  name,
  hasVersions,
  versionNumber,
  totalVersions
}: {
  readonly name: string
  readonly hasVersions: boolean
  readonly versionNumber?: number
  readonly totalVersions?: number
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const [showVersionUploadModal, setShowVersionUploadModal] = useState(false)

  // Extract original name for display and versioning
  const { baseName, extension } = parseFileName(name)
  const originalName = `${baseName}${extension}`

  const handleShowVersions = () => {
    if (!session) return

    // If it's a PDF, navigate to the PDF viewer which has version controls
    if (name.toLowerCase().endsWith('.pdf')) {
      router.push(`/documents/view/${encodeURIComponent(name)}`)
    } else {
      // For non-PDFs, we need a different approach - could be a modal with version list
      // For now, just show a message
      toast({
        title: 'Version management',
        description: 'Version management for non-PDF files is coming soon.'
      })
    }
  }

  const handleNewVersion = () => {
    if (!session) return
    setShowVersionUploadModal(true)
  }

  return (
    <>
      <div className='flex items-center gap-2'>
        {hasVersions ? (
          <Button
            variant='ghost'
            size='sm'
            className='text-xs'
            onClick={handleShowVersions}
            disabled={!session}
          >
            <Clock className='h-3 w-3 mr-1' />
            {versionNumber && totalVersions
              ? `v${versionNumber}/${totalVersions}`
              : 'Versions'}
          </Button>
        ) : (
          <Button
            variant='ghost'
            size='sm'
            className='text-xs'
            onClick={handleNewVersion}
            disabled={!session}
          >
            New Version
          </Button>
        )}
      </div>

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

function DeleteCell({ name }: { readonly name: string }) {
  const { data: session } = useSession()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDeleteClick = () => {
    if (!session || isDeleting) return
    setShowConfirmation(true)
  }

  const confirmDelete = async () => {
    if (!session || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/documents/delete?name=${encodeURIComponent(name)}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Delete failed')
      }

      toast({
        title: 'Document deleted',
        description: `${name} has been deleted successfully.`,
        duration: 3000
      })

      // Refresh the page to update the document list
      window.location.reload()
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsDeleting(false)
      setShowConfirmation(false)
    }
  }

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        onClick={handleDeleteClick}
        disabled={!session || isDeleting}
        className='text-destructive hover:text-destructive'
        title='Delete'
      >
        <Trash2 className={isDeleting ? 'animate-pulse' : ''} />
      </Button>

      {showConfirmation && (
        <DeleteConfirmationModal
          fileNames={name}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmation(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}

export const columns: ColumnDef<Document>[] = [
  // Selection column
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false
  },
  // Document details columns
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Name
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    cell: ({ row }) => (
      <DocumentNameCell
        name={row.getValue('name')}
        type={row.getValue('type')}
        hasVersions={row.original.hasVersions}
        versionNumber={row.original.versionNumber}
        totalVersions={row.original.totalVersions}
        originalName={row.original.originalName}
      />
    ),
    enableSorting: true
  },
  {
    accessorKey: 'uploadedAt',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Upload Date
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    enableSorting: true
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Type
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    enableSorting: true
  },
  {
    accessorKey: 'size',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Size
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB, columnId) => {
      // Custom sorting function for size (converts "1.5 MB" to bytes for proper comparison)
      const getSizeInBytes = (sizeStr: string) => {
        const units: { [key: string]: number } = {
          Bytes: 1,
          KB: 1024,
          MB: 1024 * 1024,
          GB: 1024 * 1024 * 1024
        }

        const parts = sizeStr.split(' ')
        if (parts.length !== 2) return 0

        const value = parseFloat(parts[0])
        const unit = parts[1]

        return value * (units[unit] || 1)
      }

      const sizeA = getSizeInBytes(rowA.getValue(columnId))
      const sizeB = getSizeInBytes(rowB.getValue(columnId))

      return sizeA - sizeB
    }
  },
  {
    id: 'version',
    header: 'Version',
    cell: ({ row }) => (
      <VersionCell
        name={row.getValue('name')}
        hasVersions={row.original.hasVersions}
        versionNumber={row.original.versionNumber}
        totalVersions={row.original.totalVersions}
      />
    ),
    enableSorting: false
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className='flex space-x-1'>
        <DownloadCell name={row.getValue('name')} />
        <ShareCell name={row.getValue('name')} />
        <DeleteCell name={row.getValue('name')} />
      </div>
    ),
    enableSorting: false
  }
]
