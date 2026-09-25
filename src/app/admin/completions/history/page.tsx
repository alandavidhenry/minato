// src/app/admin/completions/history/page.tsx
'use client'

import { Download } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

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

  const columns: ColumnDef<typeof dataTableFeatures, CompletionRow>[] = [
    {
      id: 'company',
      accessorFn: (row) => row.assignment.customerCompany.name,
      header: 'Company',
      cell: ({ row }) => (
        <Link
          href={`/admin/companies/${row.original.assignment.customerCompany.id}`}
          className='font-medium hover:underline'
        >
          {row.original.assignment.customerCompany.name}
        </Link>
      )
    },
    {
      id: 'template',
      accessorFn: (row) => row.assignment.template.title,
      header: 'Template',
      cell: ({ row }) => (
        <Link href='/admin/templates' className='hover:underline'>
          {row.original.assignment.template.title}
        </Link>
      )
    },
    {
      id: 'signedBy',
      accessorFn: (row) => row.signer.displayName,
      header: 'Signed By'
    },
    {
      id: 'signedAt',
      accessorFn: (row) => new Date(row.signedAt).getTime(),
      sortFn: 'basic',
      header: 'Signed At',
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          {formatDateTime(row.original.signedAt)}
        </span>
      )
    },
    {
      id: 'download',
      header: 'Download',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='icon'
          disabled={!row.original.blobPath || downloadingId === row.original.id}
          onClick={() => handleDownload(row.original)}
        >
          <Download className='h-4 w-4' />
        </Button>
      )
    }
  ]

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
      <PageHeader
        title='Completions History'
        description='Every recorded sign-off, filterable by date.'
      />

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

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyTitle={
          completions.length === 0
            ? 'No completions yet'
            : 'No completions match this date range'
        }
      />
    </div>
  )
}

export default function CompletionsHistoryPage() {
  return (
    <Suspense
      fallback={<p className='text-sm text-muted-foreground'>Loading...</p>}
    >
      <CompletionsHistoryContent />
    </Suspense>
  )
}
