// src/app/admin/completions/[companyId]/[assignmentId]/page.tsx
'use client'

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

const PDFRenderer = dynamic(
  () =>
    import('@/app/documents/view/[...name]/components/PDFRenderer').then(
      (m) => m.PDFRenderer
    ),
  { ssr: false }
)

interface Completion {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string }
}

interface OutstandingUser {
  id: string
  displayName: string
  email: string
}

export default function AssignmentCompletionsPage() {
  const { companyId, assignmentId } = useParams<{
    companyId: string
    assignmentId: string
  }>()
  const [completions, setCompletions] = useState<Completion[]>([])
  const [outstandingUsers, setOutstandingUsers] = useState<OutstandingUser[]>(
    []
  )
  const [templateTitle, setTemplateTitle] = useState<string>('')
  const [companyName, setCompanyName] = useState<string>('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [isOverdue, setIsOverdue] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [viewingCompletion, setViewingCompletion] = useState<{
    id: string
    title: string
  } | null>(null)
  const [viewPdfData, setViewPdfData] = useState<Uint8Array | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  useBreadcrumbLabel(
    `/admin/completions/${companyId}`,
    companyName || undefined
  )
  useBreadcrumbLabel(
    `/admin/completions/${companyId}/${assignmentId}`,
    templateTitle || undefined
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setSelected(new Set())
    try {
      const [companyRes, completionsRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}`),
        fetch(
          `/api/admin/companies/${companyId}/assignments/${assignmentId}/completions`
        )
      ])
      if (!companyRes.ok) throw new Error('Company not found')
      if (!completionsRes.ok) throw new Error('Failed to load data')
      const [companyData, completionsData] = await Promise.all([
        companyRes.json(),
        completionsRes.json()
      ])
      setCompanyName(companyData.company.name)
      setCompletions(completionsData.completions)
      setOutstandingUsers(completionsData.outstandingUsers ?? [])
      setTemplateTitle(completionsData.templateTitle ?? '')
      setDueDate(completionsData.dueDate ?? null)
      setIsOverdue(completionsData.isOverdue ?? false)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load completions.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [companyId, assignmentId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === completions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(completions.map((c) => c.id)))
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    if (
      !confirm(
        `Delete ${selected.size} completion${selected.size === 1 ? '' : 's'}? This cannot be undone.`
      )
    )
      return

    setDeletingSelected(true)
    const ids = Array.from(selected)
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/completions/${id}`, { method: 'DELETE' }).then((r) =>
          r.ok ? null : id
        )
      )
    )
    const failed = results.filter(Boolean)
    setDeletingSelected(false)

    if (failed.length === 0) {
      toast({
        title: 'Deleted',
        description: `${ids.length} completion${ids.length === 1 ? '' : 's'} deleted.`
      })
    } else {
      toast({
        title: 'Partial failure',
        description: `${ids.length - failed.length} deleted, ${failed.length} failed.`,
        variant: 'destructive'
      })
    }
    fetchData()
  }

  async function handleDownload(completion: Completion) {
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

  async function handleView(completion: Completion) {
    if (!completion.blobPath) return
    setViewingCompletion({ id: completion.id, title: templateTitle })
    setViewPdfData(null)
    setViewLoading(true)
    try {
      const dlRes = await fetch(
        `/api/admin/completions/${completion.id}/download`
      )
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
      setViewPdfData(new Uint8Array(buffer))
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load PDF',
        variant: 'destructive'
      })
      setViewingCompletion(null)
    } finally {
      setViewLoading(false)
    }
  }

  async function handleDelete(completion: Completion) {
    if (
      !confirm(
        `Delete this completion by ${completion.signer.displayName}? This cannot be undone.`
      )
    )
      return

    setDeleting(completion.id)
    try {
      const response = await fetch(`/api/admin/completions/${completion.id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete completion')
      }
      toast({ title: 'Deleted', description: 'Completion deleted.' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete completion',
        variant: 'destructive'
      })
    } finally {
      setDeleting(null)
    }
  }

  const allChecked =
    completions.length > 0 && selected.size === completions.length
  const someChecked = selected.size > 0 && selected.size < completions.length

  function renderCompletionRows() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            Loading...
          </TableCell>
        </TableRow>
      )
    }

    if (completions.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={5}
            className='h-12 text-center text-muted-foreground'
          >
            No completions yet.
          </TableCell>
        </TableRow>
      )
    }

    return completions.map((completion) => (
      <TableRow
        key={completion.id}
        data-state={selected.has(completion.id) ? 'selected' : undefined}
      >
        <TableCell className='w-10'>
          <Checkbox
            checked={selected.has(completion.id)}
            onCheckedChange={() => toggleOne(completion.id)}
            aria-label='Select row'
          />
        </TableCell>
        <TableCell>
          <div>{completion.signer.displayName}</div>
          <div className='text-xs text-muted-foreground'>
            {completion.signer.email}
          </div>
        </TableCell>
        <TableCell className='text-muted-foreground'>
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
          <div className='flex items-center justify-end gap-1'>
            {completion.blobPath && (
              <>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleView(completion)}
                >
                  <Eye className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={downloading === completion.id}
                  onClick={() => handleDownload(completion)}
                >
                  <Download className='h-4 w-4' />
                </Button>
              </>
            )}
            <Button
              variant='ghost'
              size='sm'
              disabled={deleting === completion.id}
              onClick={() => handleDelete(completion)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link
          href={`/admin/completions/${companyId}`}
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          {companyName || 'Back'}
        </Link>
        <h1 className='text-3xl font-bold'>{templateTitle || '...'}</h1>
        {dueDate && (
          <div className='flex items-center gap-2'>
            {isOverdue ? (
              <Badge variant='destructive' className='gap-1'>
                <AlertCircle className='h-3 w-3' />
                Overdue —{' '}
                {new Date(dueDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Badge>
            ) : (
              <Badge variant='secondary' className='gap-1'>
                <Clock className='h-3 w-3' />
                Due{' '}
                {new Date(dueDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </Badge>
            )}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className='flex items-center gap-3'>
          <span className='text-sm text-muted-foreground'>
            {selected.size} selected
          </span>
          <Button
            variant='destructive'
            size='sm'
            disabled={deletingSelected}
            onClick={handleDeleteSelected}
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete selected
          </Button>
        </div>
      )}

      {/* Completed */}
      <div>
        <h2 className='text-lg font-semibold mb-3'>Completed</h2>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-10'>
                  <Checkbox
                    checked={someChecked ? 'indeterminate' : allChecked}
                    onCheckedChange={toggleAll}
                    aria-label='Select all'
                  />
                </TableHead>
                <TableHead>Completed by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderCompletionRows()}</TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!viewingCompletion}
        onOpenChange={(open) => {
          if (!open) {
            setViewingCompletion(null)
            setViewPdfData(null)
          }
        }}
      >
        <DialogContent className='max-w-4xl h-[90vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>
              {viewingCompletion?.title ?? 'Completion'}
            </DialogTitle>
          </DialogHeader>
          <div className='flex-1 overflow-auto'>
            <PDFRenderer
              pdfData={viewPdfData}
              isLoading={viewLoading}
              fileName={`${viewingCompletion?.title ?? 'completion'}.pdf`}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Outstanding */}
      {!isLoading && outstandingUsers.length > 0 && (
        <div>
          <h2 className='text-lg font-semibold mb-3'>
            Outstanding
            {isOverdue && (
              <Badge variant='destructive' className='ml-2 gap-1 align-middle'>
                <AlertCircle className='h-3 w-3' />
                Overdue
              </Badge>
            )}
          </h2>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {user.email}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
