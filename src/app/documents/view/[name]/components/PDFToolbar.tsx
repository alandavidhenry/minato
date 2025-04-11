'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { VersionSelector } from '@/components/version-selector'

interface PDFToolbarProps {
  readonly displayName: string
  readonly currentFileName: string
  readonly currentVersion: number
  readonly totalVersions: number
  readonly onVersionChange: (versionFileName: string) => void
  readonly onNewVersion: () => void
}

export function PDFToolbar({
  displayName,
  currentFileName,
  currentVersion,
  totalVersions,
  onVersionChange,
  onNewVersion
}: PDFToolbarProps) {
  const router = useRouter()

  return (
    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
      <div className='flex items-center gap-2'>
        {/* Make the back button larger on mobile */}
        <Button
          variant='ghost'
          onClick={() => router.back()}
          className='h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-4'
        >
          <ArrowLeft className='h-5 w-5 sm:h-4 sm:w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Back</span>
        </Button>
        <h1 className='text-xl sm:text-2xl font-bold truncate max-w-[200px] sm:max-w-none'>
          {displayName}
        </h1>
      </div>

      {/* Version selector */}
      <VersionSelector
        fileName={currentFileName}
        currentVersion={currentVersion}
        totalVersions={totalVersions}
        onVersionChange={onVersionChange}
        onUploadNewVersion={onNewVersion}
      />
    </div>
  )
}
