// src/app/admin/completions/[companyId]/[templateId]/page.tsx
'use client'

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Lock,
  Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { TableSkeleton } from '@/components/table-skeleton'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { toast } from '@/components/ui/use-toast'
import {
  DEFAULT_COMPLETION_RETENTION_YEARS,
  getRetentionEndDate,
  isWithinRetentionPeriod
} from '@/lib/data-retention'

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
  const [retentionYears, setRetentionYears] = useState(
    DEFAULT_COMPLETION_RETENTION_YEARS
  )

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
      const [companyRes, completionsRes, retentionRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}`),
        fetch(`/api/admin/companies/${companyId}/completions/${templateId}`),
        fetch('/api/admin/settings/data-retention')
      ])
      if (!companyRes.ok) throw new Error('Company not found')
      if (!completionsRes.ok) throw new Error('Failed to load data')
      const [companyData, completionsData] = await Promise.all([
        companyRes.json(),
        completionsRes.json()
      ])
      if (retentionRes.ok) {
        const retentionData = await retentionRes.json()
        setRetentionYears(retentionData.retentionYears)
      }
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

  function isProtected(completion: Completion) {
    return isWithinRetentionPeriod(completion.signedAt, retentionYears)
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableCompletions = completions.filter((c) => !isProtected(c))

  function toggleAll() {
    if (selected.size === selectableCompletions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableCompletions.map((c) => c.id)))
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
    selectableCompletions.length > 0 &&
    selected.size === selectableCompletions.length
  const someChecked =
    selected.size > 0 && selected.size < selectableCompletions.length

  function renderCompletionRows() {
    if (isLoading) {
      return <TableSkeleton columns={5} />
    }

    if (completions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='p-0'>
            <EmptyState title='No completions yet' />
          </TableCell>
        </TableRow>
      )
    }

    return completions.map((completion) => {
      const protectedByRetention = isProtected(completion)
      return (
        <TableRow
          key={completion.id}
          data-state={selected.has(completion.id) ? 'selected' : undefined}
        >
          <TableCell className='w-10'>
            <Checkbox
              checked={selected.has(completion.id)}
              onCheckedChange={() => toggleOne(completion.id)}
              disabled={protectedByRetention}
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
              {protectedByRetention ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant='ghost' size='sm' disabled>
                        <Lock className='h-4 w-4' />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Protected until{' '}
                    {getRetentionEndDate(
                      completion.signedAt,
                      retentionYears
                    ).toLocaleDateString('en-GB')}{' '}
                    under the {retentionYears}-year data retention policy
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={deleting === completion.id}
                  onClick={() => handleDelete(completion)}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      )
    })
  }

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
