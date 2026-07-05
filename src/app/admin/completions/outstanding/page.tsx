// src/app/admin/completions/outstanding/page.tsx
'use client'

import { Download, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortArrows } from '@/components/ui/data-table/sort-arrows'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

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

type SortKey = 'dueDate' | 'company' | 'template' | 'overdue'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
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

  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredAndSorted = useMemo(() => {
    const filtered = rows.filter((r) => {
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

    const sorted = [...filtered].sort((a, b) => {
      let cmp: number
      switch (sortKey) {
        case 'company':
          cmp = a.company.name.localeCompare(b.company.name)
          break
        case 'template':
          cmp = a.template.title.localeCompare(b.template.title)
          break
        case 'overdue':
          cmp = Number(a.isOverdue) - Number(b.isOverdue)
          break
        case 'dueDate':
        default:
          if (a.dueDate === null && b.dueDate === null) cmp = 0
          else if (a.dueDate === null) cmp = 1
          else if (b.dueDate === null) cmp = -1
          else cmp = a.dueDate.localeCompare(b.dueDate)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [
    rows,
    selectedCompanyIds,
    templateFilter,
    jobRoleFilter,
    fromDate,
    toDate,
    overdueOnly,
    sortKey,
    sortDir
  ])

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
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <h1 className='text-3xl font-bold'>Outstanding Completions</h1>
        <div className='flex gap-2'>
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
        </div>
      </div>

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

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHead('Company', 'company')}
              {renderSortableHead('Template', 'template')}
              <TableHead>Version</TableHead>
              <TableHead>Assigned To</TableHead>
              {renderSortableHead('Due Date', 'dueDate')}
              {renderSortableHead('Overdue', 'overdue')}
              <TableHead>Last Reminder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='h-24 text-center'>
                  {rows.length === 0
                    ? 'No outstanding completions. Everything is up to date.'
                    : 'No results match your filters.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((r) => (
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
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant='secondary'>v{r.templateVersion}</Badge>
                  </TableCell>
                  <TableCell>{r.assignedTo}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {formatDate(r.dueDate)}
                  </TableCell>
                  <TableCell>
                    {r.isOverdue ? (
                      <Badge variant='destructive'>
                        {r.daysOverdue} {r.daysOverdue === 1 ? 'day' : 'days'}
                      </Badge>
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground whitespace-nowrap'>
                    {formatDate(r.lastReminderSentAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function OutstandingCompletionsPage() {
  return (
    <Suspense fallback={<div className='text-3xl font-bold'>Loading...</div>}>
      <OutstandingCompletionsContent />
    </Suspense>
  )
}
