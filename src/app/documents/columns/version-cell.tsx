// src/app/documents/columns/version-cell.tsx
'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { VersionUploadModal } from '@/components/version-upload-modal'
import { parseFileName } from '@/lib/version-manager'

export function VersionCell({
  name,
  path,
  hasVersions,
  versionNumber,
  totalVersions
}: {
  readonly name: string
  readonly path?: string
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
      router.push(`/documents/view/${encodeURIComponent(path ?? name)}`)
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
