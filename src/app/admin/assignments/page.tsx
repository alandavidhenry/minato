// src/app/admin/assignments/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { SortArrows } from '@/components/ui/data-table/sort-arrows'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

interface AssignmentRow {
  assignmentId: string
  company: { id: string; name: string }
  template: { id: string; title: string }
  templateVersion: number
  assignedTo: string
  dueDate: string | null
  createdAt: string
  completionCount: number
}

type SortKey = 'company' | 'template' | 'dueDate' | 'createdAt'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

export default function AllAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetch('/api/admin/assignments')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then((data) => setRows(data.assignments ?? []))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load assignments.',
          variant: 'destructive'
        })
      })
      .finally(() => setIsLoading(false))
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'company':
          cmp = a.company.name.localeCompare(b.company.name)
          break
        case 'template':
          cmp = a.template.title.localeCompare(b.template.title)
          break
        case 'dueDate':
          if (a.dueDate === null && b.dueDate === null) cmp = 0
          else if (a.dueDate === null) cmp = 1
          else if (b.dueDate === null) cmp = -1
          else cmp = a.dueDate.localeCompare(b.dueDate)
          break
        case 'createdAt':
        default:
          cmp = a.createdAt.localeCompare(b.createdAt)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  function renderSortableHead(label: string, key: SortKey) {
    return (
      <TableHead
        className='cursor-pointer select-none'
        onClick={() => toggleSort(key)}
      >
        <span className='inline-flex items-center'>
          {label}
          <SortArrows
            sorted={sortKey === key}
            direction={sortKey === key ? sortDir : false}
          />
        </span>
      </TableHead>
    )
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>All Assignments</h1>

      <p className='text-sm text-muted-foreground'>
        {sorted.length} {sorted.length === 1 ? 'assignment' : 'assignments'}
      </p>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHead('Company', 'company')}
              {renderSortableHead('Template', 'template')}
              <TableHead>Assigned To</TableHead>
              {renderSortableHead('Due Date', 'dueDate')}
              {renderSortableHead('Created', 'createdAt')}
              <TableHead>Completions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  No assignments yet.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <TableRow key={r.assignmentId}>
                  <TableCell className='font-medium'>
                    <Link
                      href={`/admin/companies/${r.company.id}`}
                      className='hover:underline'
                    >
                      {r.company.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href='/admin/templates' className='hover:underline'>
                      {r.template.title}
                    </Link>{' '}
                    <Badge variant='secondary'>v{r.templateVersion}</Badge>
                  </TableCell>
                  <TableCell>{r.assignedTo}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDate(r.dueDate)}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>{r.completionCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
