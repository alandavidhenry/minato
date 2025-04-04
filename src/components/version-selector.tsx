// src/components/version-selector.tsx
'use client'

import { Clock, FileUp, Menu } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { parseFileName } from '@/lib/version-manager'

interface VersionSelectorProps {
  readonly fileName: string
  readonly currentVersion?: number
  readonly totalVersions?: number
  readonly onVersionChange: (versionFileName: string) => void
  readonly onUploadNewVersion: () => void
}

interface VersionItem {
  fileName: string
  versionNumber: number
  uploadedAt: string
}

export function VersionSelector({
  fileName,
  currentVersion = 1,
  totalVersions = 1,
  onVersionChange,
  onUploadNewVersion
}: VersionSelectorProps) {
  const { data: session } = useSession()
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Extract the base name to fetch all versions
  const { baseName } = parseFileName(fileName)

  useEffect(() => {
    const fetchVersions = async () => {
      if (!baseName) return

      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/documents/versions?baseName=${encodeURIComponent(baseName)}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch document versions')
        }

        const data = await response.json()
        setVersions(data.versions)
      } catch (error) {
        console.error('Error fetching versions:', error)
        toast({
          title: 'Error',
          description: 'Failed to load document versions',
          variant: 'destructive'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchVersions()
  }, [baseName])

  if (totalVersions <= 1) {
    return (
      <Button
        variant='outline'
        size='sm'
        className='gap-2'
        onClick={onUploadNewVersion}
        disabled={!session}
      >
        <FileUp className='h-4 w-4' />
        Upload New Version
      </Button>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='sm' className='gap-2'>
            <Clock className='h-4 w-4' />
            Version {currentVersion} of {totalVersions}
            <Menu className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-56'>
          {isLoading ? (
            <div className='flex justify-center p-2'>Loading versions...</div>
          ) : (
            <>
              {versions.map((version) => (
                <DropdownMenuItem
                  key={version.fileName}
                  onClick={() => onVersionChange(version.fileName)}
                  className={
                    version.versionNumber === currentVersion ? 'bg-accent' : ''
                  }
                >
                  <div className='flex flex-col'>
                    <span>Version {version.versionNumber}</span>
                    <span className='text-xs text-muted-foreground'>
                      {version.uploadedAt}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onUploadNewVersion} disabled={!session}>
            <FileUp className='h-4 w-4 mr-2' />
            Upload New Version
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
