// src/app/customer/completions/page.tsx
'use client'

import { Download, Eye, FileCheck, QrCode, Share2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { QrCodeModal } from '@/components/qr-code-modal'
import { ShareModal } from '@/components/share-modal'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

interface Completion {
  id: string
  signedAt: string
  blobPath: string | null
  assignment: {
    id: string
    template: {
      title: string
    }
  }
}

interface GroupedCompletion {
  assignmentId: string
  title: string
  latestId: string
  latestSignedAt: string
  latestBlobPath: string | null
  totalVersions: number
}

function groupCompletions(completions: Completion[]): GroupedCompletion[] {
  const map = new Map<string, GroupedCompletion>()
  // API returns completions ordered newest-first, so the first occurrence per
  // assignment is already the latest.
  for (const c of completions) {
    const key = c.assignment.id
    if (!map.has(key)) {
      map.set(key, {
        assignmentId: key,
        title: c.assignment.template.title,
        latestId: c.id,
        latestSignedAt: c.signedAt,
        latestBlobPath: c.blobPath,
        totalVersions: 1
      })
    } else {
      map.get(key)!.totalVersions++
    }
  }
  return Array.from(map.values())
}

export default function CompletedFormsPage() {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)
  const [shareModalId, setShareModalId] = useState<string | null>(null)
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null)
  const [qrModalTitle, setQrModalTitle] = useState<string>('')

  useEffect(() => {
    async function fetchCompletions() {
      try {
        const res = await fetch('/api/customer/completions')
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to load completed forms')
        }
        const data = await res.json()
        setCompletions(data.completions)
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load completed forms.',
          variant: 'destructive'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompletions()
  }, [])

  function makeShareUrlGenerator(id: string) {
    return async (expirationDays: number): Promise<string> => {
      const res = await fetch(
        `/api/customer/completions/${id}/share?expirationDays=${expirationDays}`
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to generate share link')
      }
      const { shareUrl } = await res.json()
      return shareUrl
    }
  }

  async function handleQrCode(id: string, title: string) {
    setSharing(id)
    try {
      const shareUrl = await makeShareUrlGenerator(id)(7)
      setQrModalTitle(title)
      setQrModalUrl(shareUrl)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to generate QR code',
        variant: 'destructive'
      })
    } finally {
      setSharing(null)
    }
  }

  const grouped = groupCompletions(completions)

  async function handleDownload(id: string) {
    setDownloading(id)
    try {
      const res = await fetch(`/api/customer/completions/${id}/download`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to get download link')
      }
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download form.',
        variant: 'destructive'
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Completed Forms</h1>

      {isLoading ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>Loading completed forms...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>No completed forms yet.</p>
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Last Completed</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((group) => (
                <TableRow key={group.assignmentId}>
                  <TableCell className='font-medium'>
                    <span className='flex items-center gap-2'>
                      <FileCheck className='h-4 w-4 text-muted-foreground' />
                      {group.title}
                      {group.totalVersions > 1 && (
                        <span className='text-xs text-muted-foreground'>
                          {group.totalVersions} versions
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {new Date(group.latestSignedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className='text-right'>
                    {group.latestBlobPath ? (
                      <div className='flex items-center justify-end gap-2'>
                        <Button size='sm' variant='outline' asChild>
                          <Link
                            href={`/customer/completions/${group.latestId}/view`}
                          >
                            <Eye className='mr-1 h-3 w-3' />
                            View
                          </Link>
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={downloading === group.latestId}
                          onClick={() => handleDownload(group.latestId)}
                        >
                          <Download className='mr-1 h-3 w-3' />
                          {downloading === group.latestId
                            ? 'Preparing...'
                            : 'Download'}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={sharing === group.latestId}
                          onClick={() => setShareModalId(group.latestId)}
                          title='Share'
                        >
                          <Share2 className='h-3 w-3' />
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={sharing === group.latestId}
                          onClick={() =>
                            handleQrCode(group.latestId, group.title)
                          }
                          title='QR Code'
                        >
                          <QrCode
                            className={`h-3 w-3${sharing === group.latestId ? ' animate-pulse' : ''}`}
                          />
                        </Button>
                      </div>
                    ) : (
                      <span className='text-xs text-muted-foreground'>
                        PDF not available
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {shareModalId && (
        <ShareModal
          fileName={`completion-${shareModalId}.pdf`}
          getShareUrl={makeShareUrlGenerator(shareModalId)}
          onClose={() => setShareModalId(null)}
          onShareGenerated={() => {}}
        />
      )}

      {qrModalUrl && (
        <QrCodeModal
          url={qrModalUrl}
          fileName={qrModalTitle}
          onClose={() => {
            setQrModalUrl(null)
            setQrModalTitle('')
          }}
        />
      )}
    </div>
  )
}
