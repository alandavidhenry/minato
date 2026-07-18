// src/app/admin/completions/[companyId]/page.tsx
'use client'

import { AlertCircle, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { Badge } from '@/components/ui/badge'
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
  templateId: string
  template: { id: string; title: string }
  templateVersion: number
  completionCount: number
  lastCompletedAt: string | null
  dueDate: string | null
  isOverdue: boolean
  outstandingCount: number
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

  function renderRows() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            Loading...
          </TableCell>
        </TableRow>
      )
    }

    if (groups.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            No templates assigned to this company.
          </TableCell>
        </TableRow>
      )
    }

    return groups.map((group) => (
      <TableRow
        key={group.templateId}
        className='cursor-pointer hover:bg-muted/50'
      >
        <TableCell>
          <Link
            href={`/admin/completions/${companyId}/${group.templateId}`}
            className='flex items-center gap-2 font-medium'
          >
            <FileText className='h-4 w-4 text-muted-foreground' />
            {group.template.title}
            {group.templateVersion > 1 && (
              <Badge variant='secondary' className='text-xs'>
                v{group.templateVersion}
              </Badge>
            )}
          </Link>
        </TableCell>
        <TableCell>
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
        </TableCell>
        <TableCell>
          <Badge variant='secondary'>{group.completionCount}</Badge>
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {group.dueDate
            ? new Date(group.dueDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            : '—'}
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {group.lastCompletedAt
            ? new Date(group.lastCompletedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            : '—'}
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link
          href='/admin/completions'
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Completions
        </Link>
        <h1 className='text-3xl font-bold'>{companyName || '...'}</h1>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Completions</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Last completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>
    </div>
  )
}
