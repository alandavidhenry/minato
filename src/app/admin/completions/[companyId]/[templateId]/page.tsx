// src/app/admin/completions/[companyId]/[templateId]/page.tsx
'use client'

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

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

export default function TemplateCompletionsPage() {
  const { companyId, templateId } = useParams<{
    companyId: string
    templateId: string
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
    `/admin/completions/${companyId}/${templateId}`,
    templateTitle || undefined
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setSelected(new Set())
    try {
      const [companyRes, completionsRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}`),
        fetch(`/api/admin/companies/${companyId}/completions/${templateId}`)
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
  }, [companyId, templateId])

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

  const completionColumns: ColumnDef<typeof dataTableFeatures, Completion>[] = [
    {
      id: 'select',
      enableSorting: false,
      header: () => (
        <Checkbox
          checked={someChecked ? 'indeterminate' : allChecked}
          onCheckedChange={toggleAll}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selected.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
          aria-label='Select row'
        />
      )
    },
    {
      id: 'completedBy',
      accessorFn: (row) => row.signer.displayName,
      header: 'Completed by',
      cell: ({ row }) => (
        <>
          <div>{row.original.signer.displayName}</div>
          <div className='text-xs text-muted-foreground'>
            {row.original.signer.email}
          </div>
        </>
      )
    },
    {
      id: 'signedAt',
      accessorFn: (row) => new Date(row.signedAt).getTime(),
      sortFn: 'basic',
      header: 'Date',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {new Date(row.original.signedAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )
    },
    {
      id: 'pdf',
      header: 'PDF',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.blobPath ? (
          <Badge variant='default' className='gap-1'>
            <CheckCircle2 className='h-3 w-3' />
            PDF ready
          </Badge>
        ) : (
          <Badge variant='secondary'>No PDF</Badge>
        )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const completion = row.original
        return (
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
        )
      }
    }
  ]

  const outstandingColumns: ColumnDef<
    typeof dataTableFeatures,
    OutstandingUser
  >[] = [
    { accessorKey: 'displayName', header: 'Name' },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: false,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>{row.original.email}</span>
      )
    }
  ]

  return (
    <div className='space-y-6'>
      <PageHeader
        title={templateTitle || '...'}
        backHref={`/admin/completions/${companyId}`}
        backLabel={companyName || 'Back'}
        actions={
          dueDate ? (
            isOverdue ? (
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
            )
          ) : undefined
        }
      />

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
        <DataTable
          columns={completionColumns}
          data={completions}
          isLoading={isLoading}
          emptyTitle='No completions yet'
          rowClassName={(row) =>
            selected.has(row.id) ? 'bg-muted' : undefined
          }
        />
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
          <DataTable
            columns={outstandingColumns}
            data={outstandingUsers}
            getRowId={(user) => user.id}
          />
        </div>
      )}
    </div>
  )
}
