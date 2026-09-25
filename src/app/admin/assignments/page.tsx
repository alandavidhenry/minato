// src/app/admin/assignments/page.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table/data-table'
import { nullableDateSortValue } from '@/components/ui/data-table/sort-utils'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef, SortingState } from '@tanstack/react-table'

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

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

const columns: ColumnDef<typeof dataTableFeatures, AssignmentRow>[] = [
  {
    id: 'company',
    accessorFn: (row) => row.company.name,
    header: 'Company',
    cell: ({ row }) => (
      <Link
        href={`/admin/companies/${row.original.company.id}`}
        className='font-medium hover:underline'
      >
        {row.original.company.name}
      </Link>
    )
  },
  {
    id: 'template',
    accessorFn: (row) => row.template.title,
    header: 'Template',
    cell: ({ row }) => (
      <>
        <Link href='/admin/templates' className='hover:underline'>
          {row.original.template.title}
        </Link>{' '}
        <Badge variant='secondary'>v{row.original.templateVersion}</Badge>
      </>
    )
  },
  {
    accessorKey: 'assignedTo',
    header: 'Assigned To',
    enableSorting: false
  },
  {
    id: 'dueDate',
    accessorFn: (row) => nullableDateSortValue(row.dueDate),
    sortFn: 'basic',
    header: 'Due Date',
    cell: ({ row }) => (
      <span className='whitespace-nowrap'>
        {formatDate(row.original.dueDate)}
      </span>
    )
  },
  {
    id: 'createdAt',
    accessorFn: (row) => row.createdAt,
    header: 'Created',
    cell: ({ row }) => (
      <span className='whitespace-nowrap'>
        {formatDate(row.original.createdAt)}
      </span>
    )
  },
  {
    accessorKey: 'completionCount',
    header: 'Completions',
    enableSorting: false
  }
]

export default function AllAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ])

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

  return (
    <div className='space-y-6'>
      <PageHeader
        title='All Assignments'
        description='Every assignment across every company.'
      />

      <p className='text-sm text-muted-foreground'>
        {rows.length} {rows.length === 1 ? 'assignment' : 'assignments'}
      </p>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.assignmentId}
        isLoading={isLoading}
        emptyTitle='No assignments yet'
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  )
}
