'use client'

import { Download, FileCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { CustomerAdminPageGuard } from '@/components/auth/permission-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

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

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <h1 className='text-3xl font-bold'>Team Compliance</h1>
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

      {isLoading ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>
            {groups.length === 0
              ? 'No assignments yet.'
              : 'No results match your filters.'}
          </p>
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className='text-center'>Completed</TableHead>
                <TableHead className='text-center'>Outstanding</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((group) => (
                <TableRow key={group.assignmentId}>
                  <TableCell className='font-medium'>
                    <div className='flex items-center gap-2'>
                      <FileCheck className='h-4 w-4 text-muted-foreground shrink-0' />
                      <span>{group.template.title}</span>
                      <span className='text-xs text-muted-foreground'>
                        v{group.templateVersion}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatDate(group.dueDate)}
                  </TableCell>
                  <TableCell className='text-center'>
                    {group.completionCount}
                  </TableCell>
                  <TableCell className='text-center'>
                    <div className='flex items-center justify-center gap-2'>
                      <span>{group.outstandingCount}</span>
                      {group.isOverdue && (
                        <Badge variant='destructive'>Overdue</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        openDetails(group.assignmentId, group.template.title)
                      }
                    >
                      <Users className='mr-1 h-3 w-3' />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
                {summary.completedRecords.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    No completions yet.
                  </p>
                ) : (
                  <div className='rounded-md border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Completed</TableHead>
                          <TableHead className='text-right'>PDF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.completedRecords.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.signer.displayName}</TableCell>
                            <TableCell className='text-muted-foreground'>
                              {formatDate(r.signedAt)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {r.hasPdf ? (
                                <Button
                                  size='sm'
                                  variant='outline'
                                  disabled={downloading === r.id}
                                  onClick={() =>
                                    handleDownload(dialogAssignmentId!, r.id)
                                  }
                                >
                                  <Download className='mr-1 h-3 w-3' />
                                  {downloading === r.id
                                    ? 'Preparing...'
                                    : 'Download'}
                                </Button>
                              ) : (
                                <span className='text-xs text-muted-foreground'>
                                  Not available
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
