// src/app/admin/completions/history/page.tsx
'use client'

import { Download } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

interface CompletionRow {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string | null }
  assignment: {
    id: string
    template: { id: string; title: string }
    customerCompany: { id: string; name: string }
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function todayParam(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function CompletionsHistoryContent() {
  const searchParams = useSearchParams()

  const [completions, setCompletions] = useState<CompletionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? todayParam())

  useEffect(() => {
    fetch('/api/admin/completions/history')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then((data) => setCompletions(data.completions ?? []))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load completions.',
          variant: 'destructive'
        })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return completions.filter((c) => {
      const signedDate = c.signedAt.slice(0, 10)
      if (fromDate && signedDate < fromDate) return false
      if (toDate && signedDate > toDate) return false
      return true
    })
  }, [completions, fromDate, toDate])

  async function handleDownload(completion: CompletionRow) {
    if (!completion.blobPath) return
    setDownloadingId(completion.id)
    try {
      const response = await fetch(
        `/api/admin/completions/${completion.id}/download`
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get download link')
      }
      const { url } = await response.json()
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download',
        variant: 'destructive'
      })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Completions History</h1>

      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-muted-foreground' htmlFor='from-date'>
            Signed from
          </label>
          <Input
            id='from-date'
            type='date'
            className='w-36'
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm text-muted-foreground' htmlFor='to-date'>
            to
          </label>
          <Input
            id='to-date'
            type='date'
            className='w-36'
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <p className='text-sm text-muted-foreground'>
        {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
      </p>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Signed By</TableHead>
              <TableHead>Signed At</TableHead>
              <TableHead className='text-right'>Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  {completions.length === 0
                    ? 'No completions yet.'
                    : 'No completions match this date range.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className='font-medium'>
                    <Link
                      href={`/admin/companies/${c.assignment.customerCompany.id}`}
                      className='hover:underline'
                    >
                      {c.assignment.customerCompany.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href='/admin/templates' className='hover:underline'>
                      {c.assignment.template.title}
                    </Link>
                  </TableCell>
                  <TableCell>{c.signer.displayName}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDateTime(c.signedAt)}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='icon'
                      disabled={!c.blobPath || downloadingId === c.id}
                      onClick={() => handleDownload(c)}
                    >
                      <Download className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function CompletionsHistoryPage() {
  return (
    <Suspense fallback={<div className='text-3xl font-bold'>Loading...</div>}>
      <CompletionsHistoryContent />
    </Suspense>
  )
}
