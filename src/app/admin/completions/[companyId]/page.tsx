// src/app/admin/completions/[companyId]/page.tsx
'use client'

import { AlertCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table/data-table'
import { nullableDateSortValue } from '@/components/ui/data-table/sort-utils'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

interface CompletionGroup {
  templateId: string
  template: { id: string; title: string }
  templateVersion: number
  completionCount: number
  lastCompletedAt: string | null
  dueDate: string | null
  isOverdue: boolean
  outstandingCount: number
}

function formatShortDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—'
}

export default function CompanyCompletionsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [groups, setGroups] = useState<CompletionGroup[]>([])
  const [companyName, setCompanyName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useBreadcrumbLabel(
    `/admin/completions/${companyId}`,
    companyName || undefined
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [companyRes, groupsRes] = await Promise.all([
        fetch(`/api/admin/companies/${companyId}`),
        fetch(`/api/admin/companies/${companyId}/completions`)
      ])
      if (!companyRes.ok) throw new Error('Company not found')
      if (!groupsRes.ok) throw new Error('Failed to load assignments')
      const [companyData, groupsData] = await Promise.all([
        companyRes.json(),
        groupsRes.json()
      ])
      setCompanyName(companyData.company.name)
      setGroups(groupsData.groups)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load data.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const columns: ColumnDef<typeof dataTableFeatures, CompletionGroup>[] = [
    {
      id: 'template',
      accessorFn: (row) => row.template.title,
      header: 'Template',
      cell: ({ row }) => (
        <Link
          href={`/admin/completions/${companyId}/${row.original.templateId}`}
          className='flex items-center gap-2 font-medium'
        >
          <FileText className='h-4 w-4 text-muted-foreground' />
          {row.original.template.title}
          {row.original.templateVersion > 1 && (
            <Badge variant='secondary' className='text-xs'>
              v{row.original.templateVersion}
            </Badge>
          )}
        </Link>
      )
    },
    {
      id: 'status',
      accessorFn: (row) => row.outstandingCount,
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const group = row.original
        return (
          <div className='flex items-center gap-2'>
            {group.isOverdue && (
              <Badge variant='destructive' className='gap-1'>
                <AlertCircle className='h-3 w-3' />
                Overdue
              </Badge>
            )}
            {group.outstandingCount > 0 && !group.isOverdue && (
              <Badge variant='secondary'>
                {group.outstandingCount} outstanding
              </Badge>
            )}
            {group.outstandingCount === 0 && group.completionCount > 0 && (
              <Badge variant='default'>Complete</Badge>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: 'completionCount',
      header: 'Completions',
      cell: ({ row }) => (
        <Badge variant='secondary'>{row.original.completionCount}</Badge>
      )
    },
    {
      id: 'dueDate',
      accessorFn: (row) => nullableDateSortValue(row.dueDate),
      sortFn: 'basic',
      header: 'Due date',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatShortDate(row.original.dueDate)}
        </span>
      )
    },
    {
      id: 'lastCompletedAt',
      accessorFn: (row) => nullableDateSortValue(row.lastCompletedAt),
      sortFn: 'basic',
      header: 'Last completed',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatShortDate(row.original.lastCompletedAt)}
        </span>
      )
    }
  ]

  return (
    <div className='space-y-6'>
      <PageHeader
        title={companyName || '...'}
        backHref='/admin/completions'
        backLabel='Completions'
      />

      <DataTable
        columns={columns}
        data={groups}
        getRowId={(row) => row.templateId}
        isLoading={isLoading}
        emptyTitle='No templates assigned to this company'
        rowClassName={() => 'cursor-pointer'}
      />
    </div>
  )
}
