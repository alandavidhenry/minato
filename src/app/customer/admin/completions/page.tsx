'use client'

import { Download, FileCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { CustomerAdminPageGuard } from '@/components/auth/permission-guard'
import { WelcomeHeader } from '@/components/customer/welcome-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

interface CompletionGroup {
  assignmentId: string
  template: { id: string; title: string }
  templateVersion: number
  completionCount: number
  lastCompletedAt: string | null
  dueDate: string | null
  isOverdue: boolean
  outstandingCount: number
}

interface CompletedRecord {
  id: string
  signedAt: string
  hasPdf: boolean
  signer: { id: string; displayName: string; email: string }
}

interface OutstandingUser {
  id: string
  displayName: string
  email: string | null
}

interface AssignmentSummary {
  templateTitle: string
  dueDate: string | null
  isOverdue: boolean
  completedRecords: CompletedRecord[]
  outstandingUsers: OutstandingUser[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function TeamCompletionsContent() {
  const [groups, setGroups] = useState<CompletionGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const [dialogAssignmentId, setDialogAssignmentId] = useState<string | null>(
    null
  )
  const [dialogTitle, setDialogTitle] = useState('')
  const [summary, setSummary] = useState<AssignmentSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/customer/admin/completions')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load completions')
        return r.json() as Promise<{ groups: CompletionGroup[] }>
      })
      .then(({ groups: g }) => setGroups(g))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load team completions.',
          variant: 'destructive'
        })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = groups.filter((g) => {
    if (
      search &&
      !g.template.title.toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (overdueOnly && !g.isOverdue) return false
    if (fromDate && g.dueDate && g.dueDate < fromDate) return false
    if (toDate && g.dueDate && g.dueDate > toDate + 'T23:59:59.999Z')
      return false
    return true
  })

  function exportCsv() {
    const header = [
      'Template',
      'Version',
      'Due Date',
      'Completed',
      'Outstanding',
      'Overdue',
      'Last Completed'
    ]
    const rows = filtered.map((g) => [
      `"${g.template.title.replace(/"/g, '""')}"`,
      `v${g.templateVersion}`,
      g.dueDate ? new Date(g.dueDate).toLocaleDateString() : '',
      g.completionCount,
      g.outstandingCount,
      g.isOverdue ? 'Yes' : 'No',
      g.lastCompletedAt ? new Date(g.lastCompletedAt).toLocaleDateString() : ''
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'team-completions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openDetails = useCallback(
    async (assignmentId: string, title: string) => {
      setDialogAssignmentId(assignmentId)
      setDialogTitle(title)
      setSummary(null)
      setSummaryLoading(true)
      try {
        const res = await fetch(
          `/api/customer/admin/completions/${assignmentId}`
        )
        if (!res.ok) throw new Error('Failed')
        const data = (await res.json()) as { summary: AssignmentSummary }
        setSummary(data.summary)
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load assignment details.',
          variant: 'destructive'
        })
        setDialogAssignmentId(null)
      } finally {
        setSummaryLoading(false)
      }
    },
    []
  )

  async function handleDownload(assignmentId: string, completionId: string) {
    setDownloading(completionId)
    try {
      const res = await fetch(
        `/api/customer/admin/completions/${assignmentId}/download/${completionId}`
      )
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      const { url } = (await res.json()) as { url: string }
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Download failed.',
        variant: 'destructive'
      })
    } finally {
      setDownloading(null)
    }
  }

  const columns: ColumnDef<typeof dataTableFeatures, CompletionGroup>[] = [
    {
      id: 'template',
      accessorFn: (row) => row.template.title,
      header: 'Template',
      cell: ({ row }) => (
        <div className='flex items-center gap-2 font-medium'>
          <FileCheck className='h-4 w-4 text-muted-foreground shrink-0' />
          <span>{row.original.template.title}</span>
          <span className='text-xs text-muted-foreground'>
            v{row.original.templateVersion}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatDate(row.original.dueDate)}
        </span>
      )
    },
    {
      accessorKey: 'completionCount',
      header: 'Completed',
      meta: { align: 'center' },
      cell: ({ row }) => row.original.completionCount
    },
    {
      accessorKey: 'outstandingCount',
      header: 'Outstanding',
      meta: { align: 'center' },
      cell: ({ row }) => (
        <div className='flex items-center justify-center gap-2'>
          <span>{row.original.outstandingCount}</span>
          {row.original.isOverdue && (
            <Badge variant='destructive'>Overdue</Badge>
          )}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() =>
            openDetails(row.original.assignmentId, row.original.template.title)
          }
        >
          <Users className='mr-1 h-3 w-3' />
          Details
        </Button>
      )
    }
  ]

  const completedRecordColumns: ColumnDef<
    typeof dataTableFeatures,
    CompletedRecord
  >[] = [
    {
      id: 'name',
      accessorFn: (row) => row.signer.displayName,
      header: 'Name'
    },
    {
      accessorKey: 'signedAt',
      header: 'Completed',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatDate(row.original.signedAt)}
        </span>
      )
    },
    {
      id: 'pdf',
      header: 'PDF',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const record = row.original
        if (!record.hasPdf) {
          return (
            <span className='text-xs text-muted-foreground'>Not available</span>
          )
        }
        return (
          <Button
            size='sm'
            variant='outline'
            disabled={downloading === record.id}
            onClick={() => handleDownload(dialogAssignmentId!, record.id)}
          >
            <Download className='mr-1 h-3 w-3' />
            {downloading === record.id ? 'Preparing...' : 'Download'}
          </Button>
        )
      }
    }
  ]

  const outstandingCount = groups.reduce(
    (sum, g) => sum + g.outstandingCount,
    0
  )
  const subtitle = isLoading
    ? undefined
    : outstandingCount > 0
      ? `Your team has ${outstandingCount} outstanding completion${outstandingCount === 1 ? '' : 's'}.`
      : 'Your team is fully up to date.'

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <WelcomeHeader title='Team Compliance' subtitle={subtitle} />
        <Button
          variant='outline'
          size='sm'
          onClick={exportCsv}
          disabled={isLoading || filtered.length === 0}
        >
          <Download className='mr-2 h-4 w-4' />
          Export CSV
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-4'>
        <Input
          className='w-56'
          placeholder='Search template...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className='flex items-center gap-2'>
          <label className='text-sm text-muted-foreground' htmlFor='from-date'>
            Due from
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
        <div className='flex items-center gap-2'>
          <Switch
            id='overdue-only'
            checked={overdueOnly}
            onCheckedChange={setOverdueOnly}
          />
          <label htmlFor='overdue-only' className='text-sm cursor-pointer'>
            Overdue only
          </label>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(row) => row.assignmentId}
        isLoading={isLoading}
        emptyTitle={
          groups.length === 0
            ? 'No assignments yet'
            : 'No results match your filters'
        }
      />

      <Dialog
        open={dialogAssignmentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAssignmentId(null)
            setSummary(null)
          }
        }}
      >
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {summaryLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
            </div>
          ) : summary ? (
            <div className='space-y-6'>
              {(summary.dueDate || summary.isOverdue) && (
                <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                  {summary.dueDate && (
                    <span>Due: {formatDate(summary.dueDate)}</span>
                  )}
                  {summary.isOverdue && (
                    <Badge variant='destructive'>Overdue</Badge>
                  )}
                </div>
              )}

              <div>
                <h3 className='font-semibold mb-3'>
                  Completed ({summary.completedRecords.length})
                </h3>
                <DataTable
                  columns={completedRecordColumns}
                  data={summary.completedRecords}
                  emptyTitle='No completions yet.'
                />
              </div>

              <div>
                <h3 className='font-semibold mb-3'>
                  Outstanding ({summary.outstandingUsers.length})
                </h3>
                {summary.outstandingUsers.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    Everyone has completed this assignment.
                  </p>
                ) : (
                  <ul className='space-y-1'>
                    {summary.outstandingUsers.map((u) => (
                      <li
                        key={u.id}
                        className='text-sm flex items-center gap-2'
                      >
                        <Users className='h-3 w-3 text-muted-foreground shrink-0' />
                        <span>{u.displayName}</span>
                        {u.email && (
                          <span className='text-muted-foreground'>
                            ({u.email})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function TeamCompletionsPage() {
  return (
    <CustomerAdminPageGuard>
      <TeamCompletionsContent />
    </CustomerAdminPageGuard>
  )
}
