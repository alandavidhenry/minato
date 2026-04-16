// src/app/customer/files/view/[...path]/customer-pdf-viewer.tsx
'use client'

import { ArrowLeft, Clock, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { PDFRenderer } from '@/app/documents/view/[name]/components/PDFRenderer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { parseFileName } from '@/lib/version-manager'

interface VersionItem {
  fileName: string
  versionNumber: number
  uploadedAt: string
}

interface CustomerPdfViewerProps {
  readonly relativePath: string
}

async function fetchCustomerPdf(relativePath: string): Promise<Uint8Array> {
  const downloadRes = await fetch(
    `/api/customer/files/download?path=${encodeURIComponent(relativePath)}`
  )
  if (!downloadRes.ok) {
    const err = await downloadRes.json()
    throw new Error(err.error ?? 'Failed to get download URL')
  }
  const { url } = await downloadRes.json()

  const proxyRes = await fetch(
    `/api/documents/proxy?url=${encodeURIComponent(url)}`
  )
  if (!proxyRes.ok) {
    throw new Error('Failed to fetch PDF')
  }
  const arrayBuffer = await proxyRes.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export function CustomerPdfViewer({ relativePath }: CustomerPdfViewerProps) {
  const router = useRouter()
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState(relativePath)
  const [currentVersion, setCurrentVersion] = useState(1)
  const [totalVersions, setTotalVersions] = useState(1)
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)

  const { baseName, extension } = parseFileName(relativePath)
  const fileBaseName = baseName.split('/').pop() ?? baseName
  const displayName = `${fileBaseName}${extension}`

  const loadPdf = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchCustomerPdf(path)
      setPdfData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadVersions = useCallback(async (path: string) => {
    setIsLoadingVersions(true)
    try {
      const res = await fetch(
        `/api/customer/files/versions?path=${encodeURIComponent(path)}`
      )
      if (!res.ok) throw new Error('Failed to fetch versions')
      const data = await res.json()
      setVersions(data.versions)
      setTotalVersions(data.totalVersions)
      const current = data.versions.find(
        (v: VersionItem) => v.fileName === path
      )
      if (current) setCurrentVersion(current.versionNumber)
    } catch (err) {
      console.error('Error fetching versions:', err)
      toast({
        title: 'Error',
        description: 'Failed to load version history',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingVersions(false)
    }
  }, [])

  useEffect(() => {
    loadPdf(relativePath)
    loadVersions(relativePath)
  }, [relativePath, loadPdf, loadVersions])

  const handleVersionChange = useCallback(
    (versionPath: string) => {
      if (versionPath === currentPath) return
      setCurrentPath(versionPath)
      loadPdf(versionPath)
      const encoded = versionPath.split('/').map(encodeURIComponent).join('/')
      window.history.replaceState({}, '', `/customer/files/view/${encoded}`)
      const found = versions.find((v) => v.fileName === versionPath)
      if (found) setCurrentVersion(found.versionNumber)
    },
    [currentPath, loadPdf, versions]
  )

  if (error) {
    return (
      <div className='container mx-auto py-4'>
        <div className='flex flex-col gap-4 items-center'>
          <p className='text-destructive'>{error}</p>
          <Button variant='outline' onClick={() => router.back()}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto py-4'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
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

          {totalVersions > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='gap-2'>
                  <Clock className='h-4 w-4' />
                  Version {currentVersion} of {totalVersions}
                  <Menu className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56'>
                {isLoadingVersions ? (
                  <div className='flex justify-center p-2'>Loading...</div>
                ) : (
                  versions.map((v) => (
                    <DropdownMenuItem
                      key={v.fileName}
                      onClick={() => handleVersionChange(v.fileName)}
                      className={
                        v.versionNumber === currentVersion ? 'bg-accent' : ''
                      }
                    >
                      <div className='flex flex-col'>
                        <span>Version {v.versionNumber}</span>
                        <span className='text-xs text-muted-foreground'>
                          {v.uploadedAt}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <PDFRenderer
          pdfData={pdfData}
          isLoading={isLoading}
          fileName={displayName}
        />
      </div>
    </div>
  )
}
