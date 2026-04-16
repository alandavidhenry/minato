// src/app/admin/completions/page.tsx
'use client'

import { CheckCircle2, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
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

interface CompletionRecord {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string }
  assignment: {
    id: string
    template: { id: string; title: string }
    customerCompany: { id: string; name: string }
  }
}

export default function CompletionsPage() {
  const [completions, setCompletions] = useState<CompletionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchCompletions()
  }, [])

  async function fetchCompletions() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/completions')
      if (!response.ok) throw new Error('Failed to fetch completions')
      const data = await response.json()
      setCompletions(data.completions)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load completions.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownload(completion: CompletionRecord) {
    if (!completion.blobPath) return
    setDownloading(completion.id)
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
      setDownloading(null)
    }
  }

  function renderRows() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            Loading completions...
          </TableCell>
        </TableRow>
      )
    }

    if (completions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            No completions yet.
          </TableCell>
        </TableRow>
      )
    }

    return completions.map((completion) => (
      <TableRow key={completion.id}>
        <TableCell className='font-medium'>
          {completion.assignment.template.title}
        </TableCell>
        <TableCell>{completion.assignment.customerCompany.name}</TableCell>
        <TableCell>
          <div>{completion.signer.displayName}</div>
          <div className='text-xs text-muted-foreground'>
            {completion.signer.email}
          </div>
        </TableCell>
        <TableCell>
          {new Date(completion.signedAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </TableCell>
        <TableCell>
          {completion.blobPath ? (
            <Badge variant='default' className='gap-1'>
              <CheckCircle2 className='h-3 w-3' />
              PDF ready
            </Badge>
          ) : (
            <Badge variant='secondary'>No PDF</Badge>
          )}
        </TableCell>
        <TableCell className='text-right'>
          {completion.blobPath && (
            <Button
              variant='ghost'
              size='sm'
              disabled={downloading === completion.id}
              onClick={() => handleDownload(completion)}
            >
              <Download className='h-4 w-4' />
            </Button>
          )}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Completions</h1>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Completed by</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>PDF</TableHead>
              <TableHead className='text-right'>Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>
    </div>
  )
}
