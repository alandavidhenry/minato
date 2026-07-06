// src/app/customer/completions/[id]/view/completion-pdf-viewer.tsx
'use client'

import { ArrowLeft, Clock, Menu } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'

const PDFRenderer = dynamic(
  () =>
    import('@/app/documents/view/[...name]/components/PDFRenderer').then(
      (m) => m.PDFRenderer
    ),
  { ssr: false }
)

interface CompletionVersion {
  id: string
  signedAt: string
  versionNumber: number
  totalVersions: number
  hasPdf: boolean
}

interface ApiCompletion {
  id: string
  signedAt: string
  blobPath: string | null
  assignment: {
    id: string
    template: { title: string }
  }
}

interface CompletionPdfViewerProps {
  readonly completionId: string
}

export function CompletionPdfViewer({
  completionId
}: CompletionPdfViewerProps) {
  const router = useRouter()
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [versions, setVersions] = useState<CompletionVersion[]>([])
  const [currentId, setCurrentId] = useState(completionId)

  const loadPdf = useCallback(async (id: string) => {
    setIsLoading(true)
    setPdfData(null)
    try {
      const dlRes = await fetch(`/api/customer/completions/${id}/download`)
      if (!dlRes.ok) {
        const err = await dlRes.json()
        throw new Error(err.error ?? 'Failed to get download link')
      }
      const { url } = await dlRes.json()

      const proxyRes = await fetch(
        `/api/documents/proxy?url=${encodeURIComponent(url)}`
      )
      if (!proxyRes.ok) throw new Error('Failed to load PDF')

      const buffer = await proxyRes.arrayBuffer()
      setPdfData(new Uint8Array(buffer))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/customer/completions')
        if (!res.ok) throw new Error('Failed to load completions')
        const data: { completions: ApiCompletion[] } = await res.json()

        const current = data.completions.find((c) => c.id === completionId)
        if (!current) throw new Error('Completion not found')

        setTitle(current.assignment.template.title)

        // Siblings = same assignment, already ordered newest-first from the API
        const siblings = data.completions.filter(
          (c) => c.assignment.id === current.assignment.id
        )
        const total = siblings.length
        setVersions(
          siblings.map((c, i) => ({
            id: c.id,
            signedAt: c.signedAt,
            versionNumber: total - i,
            totalVersions: total,
            hasPdf: !!c.blobPath
          }))
        )
      } catch (err) {
        toast({
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to load form details',
          variant: 'destructive'
        })
      }
    }

    init()
    loadPdf(completionId)
  }, [completionId, loadPdf])

  function handleVersionChange(id: string) {
    if (id === currentId) return
    setCurrentId(id)
    window.history.replaceState({}, '', `/customer/completions/${id}/view`)
    loadPdf(id)
  }

  const currentVersion = versions.find((v) => v.id === currentId)

  if (error) {
    return (
      <div className='container mx-auto py-4'>
        <Card className='p-6'>
          <div className='flex flex-col gap-4 items-center'>
            <p className='text-destructive'>{error}</p>
            <Button onClick={() => router.push('/customer/completions')}>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back to Completed Forms
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto py-4'>
      <div className='flex flex-col gap-4'>
        {/* Toolbar */}
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
              {title}
            </h1>
          </div>

          {versions.length > 1 && currentVersion && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='gap-2'>
                  <Clock className='h-4 w-4' />
                  Version {currentVersion.versionNumber} of{' '}
                  {currentVersion.totalVersions}
                  <Menu className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56'>
                {versions.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => handleVersionChange(v.id)}
                    disabled={!v.hasPdf}
                    className={v.id === currentId ? 'bg-accent' : ''}
                  >
                    <div className='flex flex-col'>
                      <span>Version {v.versionNumber}</span>
                      <span className='text-xs text-muted-foreground'>
                        {new Date(v.signedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <PDFRenderer
          pdfData={pdfData}
          isLoading={isLoading}
          fileName={`${title}.pdf`}
        />
      </div>
    </div>
  )
}
