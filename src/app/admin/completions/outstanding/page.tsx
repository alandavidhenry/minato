// src/app/admin/completions/outstanding/page.tsx
'use client'

import { Download, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import { nullableDateSortValue } from '@/components/ui/data-table/sort-utils'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef, SortingState } from '@tanstack/react-table'

interface OutstandingRow {
  assignmentId: string
  company: { id: string; name: string }
  template: { id: string; title: string }
  templateVersion: number
  assignedTo: string
  assignedUserId: string | null
  assignedUserJobRole: string | null
  targetJobRoles: string[] | null
  dueDate: string | null
  daysOverdue: number | null
  isOverdue: boolean
  lastReminderSentAt: string | null
  outstandingCount: number
}

interface Company {
  id: string
  name: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

type SortableValue = string | number

const SORT_ACCESSORS: Record<string, (r: OutstandingRow) => SortableValue> = {
  company: (r) => r.company.name,
  template: (r) => r.template.title,
  dueDate: (r) => nullableDateSortValue(r.dueDate),
  overdue: (r) => Number(r.isOverdue)
}

function compareValues(a: SortableValue, b: SortableValue): number {
  return typeof a === 'string' && typeof b === 'string'
    ? a.localeCompare(b)
    : (a as number) - (b as number)
}

// Mirrors DataTable's own column sorting so CSV/XLSX exports respect the
// currently displayed sort order.
function sortRows(rows: OutstandingRow[], sorting: SortingState) {
  const [sort] = sorting
  const accessor = sort && SORT_ACCESSORS[sort.id]
  if (!sort || !accessor) return rows
  const sorted = [...rows].sort((a, b) =>
    compareValues(accessor(a), accessor(b))
  )
  return sort.desc ? sorted.reverse() : sorted
}

function quoteCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

function toExportRows(rows: OutstandingRow[]) {
  return rows.map((r) => ({
    company: r.company.name,
    template: r.template.title,
    version: `v${r.templateVersion}`,
    assignedTo: r.assignedTo,
    dueDate: formatDate(r.dueDate),
    daysOverdue: r.daysOverdue ?? '',
    lastReminder: formatDate(r.lastReminderSentAt)
  }))
}

function exportToCsv(rows: OutstandingRow[]) {
  const header = [
    'Company',
    'Template',
    'Version',
    'Assigned To',
    'Due Date',
    'Days Overdue',
    'Last Reminder'
  ]
  const csvRows = toExportRows(rows).map((r) =>
    [
      r.company,
      r.template,
      r.version,
      r.assignedTo,
      r.dueDate,
      r.daysOverdue,
      r.lastReminder
    ]
      .map(quoteCsvCell)
      .join(',')
  )
  const csv = [header.map(quoteCsvCell).join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `outstanding-completions-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function exportToXlsx(rows: OutstandingRow[]) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Outstanding Completions')

  sheet.columns = [
    { header: 'Company', key: 'company', width: 24 },
    { header: 'Template', key: 'template', width: 32 },
    { header: 'Version', key: 'version', width: 10 },
    { header: 'Assigned To', key: 'assignedTo', width: 24 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Days Overdue', key: 'daysOverdue', width: 14 },
    { header: 'Last Reminder', key: 'lastReminder', width: 14 }
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.addRows(toExportRows(rows))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `outstanding-completions-${new Date().toISOString().slice(0, 10)}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

function OutstandingCompletionsContent() {
  const searchParams = useSearchParams()

  const [rows, setRows] = useState<OutstandingRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExportingXlsx, setIsExportingXlsx] = useState(false)

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [templateFilter, setTemplateFilter] = useState('all')
  const [jobRoleFilter, setJobRoleFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(
    searchParams.get('overdueOnly') === 'true'
  )

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'dueDate', desc: false }
  ])

  useEffect(() => {
    fetch('/api/admin/companies')
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setIsLoading(true)
    fetch('/api/admin/completions/outstanding')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then((data) => setRows(data.rows ?? []))
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load outstanding completions.',
          variant: 'destructive'
        })
      })
      .finally(() => setIsLoading(false))
  }, [])

  const templates = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.template.id, r.template.title)
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [rows])

  const jobRoles = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.assignedUserJobRole) set.add(r.assignedUserJobRole)
      r.targetJobRoles?.forEach((role) => set.add(role))
    }
    return Array.from(set).sort()
  }, [rows])

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    )
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        selectedCompanyIds.length > 0 &&
        !selectedCompanyIds.includes(r.company.id)
      )
        return false
      if (templateFilter !== 'all' && r.template.id !== templateFilter)
        return false
      if (jobRoleFilter !== 'all') {
        const visibleToAll = !r.assignedUserId && !r.targetJobRoles?.length
        const matches =
          r.assignedUserJobRole === jobRoleFilter ||
          r.targetJobRoles?.includes(jobRoleFilter) ||
          visibleToAll
        if (!matches) return false
      }
      if (fromDate && (!r.dueDate || r.dueDate < fromDate)) return false
      if (toDate && (!r.dueDate || r.dueDate > `${toDate}T23:59:59.999Z`))
        return false
      if (overdueOnly && !r.isOverdue) return false
      return true
    })
  }, [
    rows,
    selectedCompanyIds,
    templateFilter,
    jobRoleFilter,
    fromDate,
    toDate,
    overdueOnly
  ])

  const filteredAndSorted = useMemo(
    () => sortRows(filtered, sorting),
    [filtered, sorting]
  )

  async function handleExportXlsx() {
    setIsExportingXlsx(true)
    try {
      await exportToXlsx(filteredAndSorted)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate XLSX export.',
        variant: 'destructive'
      })
    } finally {
      setIsExportingXlsx(false)
    }
  }

  const columns: ColumnDef<typeof dataTableFeatures, OutstandingRow>[] = [
    {
      id: 'company',
      accessorFn: SORT_ACCESSORS.company,
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
      accessorFn: SORT_ACCESSORS.template,
      header: 'Template',
      cell: ({ row }) => (
        <Link href='/admin/templates' className='hover:underline'>
          {row.original.template.title}
        </Link>
      )
    },
    {
      id: 'version',
      accessorKey: 'templateVersion',
      header: 'Version',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant='secondary'>v{row.original.templateVersion}</Badge>
      )
    },
    {
      accessorKey: 'assignedTo',
      header: 'Assigned To',
      enableSorting: false
    },
    {
      id: 'dueDate',
      accessorFn: SORT_ACCESSORS.dueDate,
      sortFn: 'basic',
      header: 'Due Date',
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          {formatDate(row.original.dueDate)}
        </span>
      )
    },
    {
      id: 'overdue',
      accessorFn: SORT_ACCESSORS.overdue,
      sortFn: 'basic',
      header: 'Overdue',
      cell: ({ row }) =>
        row.original.isOverdue ? (
          <Badge variant='destructive'>
            {row.original.daysOverdue}{' '}
            {row.original.daysOverdue === 1 ? 'day' : 'days'}
          </Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
    },
    {
      id: 'lastReminder',
      accessorFn: (row) => nullableDateSortValue(row.lastReminderSentAt),
      sortFn: 'basic',
      header: 'Last Reminder',
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-muted-foreground'>
          {formatDate(row.original.lastReminderSentAt)}
        </span>
      )
    }
  ]

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Outstanding Completions'
        actions={
          <>
            <Button
              variant='outline'
              onClick={() => exportToCsv(filteredAndSorted)}
              disabled={isLoading || filteredAndSorted.length === 0}
            >
              <Download className='mr-2 h-4 w-4' />
              Export CSV
            </Button>
            <Button
              variant='outline'
              onClick={handleExportXlsx}
              disabled={
                isLoading || filteredAndSorted.length === 0 || isExportingXlsx
              }
            >
              <FileSpreadsheet className='mr-2 h-4 w-4' />
              {isExportingXlsx ? 'Exporting…' : 'Export XLSX'}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-4'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              className='w-44 justify-start font-normal'
            >
              {selectedCompanyIds.length === 0
                ? 'All Companies'
                : `Company (${selectedCompanyIds.length})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='max-h-72 overflow-y-auto'>
            {companies.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={selectedCompanyIds.includes(c.id)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggleCompany(c.id)}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='All templates' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Templates</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={jobRoleFilter} onValueChange={setJobRoleFilter}>
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='All job roles' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Job Roles</SelectItem>
            {jobRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      <p className='text-sm text-muted-foreground'>
        {filteredAndSorted.length}{' '}
        {filteredAndSorted.length === 1 ? 'result' : 'results'}
      </p>

      <DataTable
        columns={columns}
        data={filteredAndSorted}
        getRowId={(row) => row.assignmentId}
        isLoading={isLoading}
        emptyTitle={
          rows.length === 0
            ? 'No outstanding completions'
            : 'No results match your filters'
        }
        emptyDescription={
          rows.length === 0 ? 'Everything is up to date.' : undefined
        }
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  )
}

export default function OutstandingCompletionsPage() {
  return (
    <Suspense
      fallback={<p className='text-sm text-muted-foreground'>Loading...</p>}
    >
      <OutstandingCompletionsContent />
    </Suspense>
  )
}
