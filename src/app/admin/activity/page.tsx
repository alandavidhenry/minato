'use client'

import { Download, Eye, FileUp, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ComplianceDashboard } from '@/components/admin/ComplianceDashboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { ActivityType } from '@/lib/activity-logger'

interface ActivityLog {
  id: string
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
  timestamp: string
  ipAddress?: string
}

interface Company {
  id: string
  name: string
}

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  [ActivityType.VIEW]: 'View',
  [ActivityType.DOWNLOAD]: 'Download',
  [ActivityType.UPLOAD]: 'Upload',
  [ActivityType.NEW_VERSION]: 'New Version',
  [ActivityType.RENAME]: 'Rename',
  [ActivityType.DELETE]: 'Delete',
  [ActivityType.MOVE]: 'Move'
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case ActivityType.VIEW:
      return <Eye className='h-4 w-4' />
    case ActivityType.DOWNLOAD:
      return <Download className='h-4 w-4' />
    case ActivityType.UPLOAD:
    case ActivityType.NEW_VERSION:
      return <FileUp className='h-4 w-4' />
    default:
      return null
  }
}

function getActivityBadgeVariant(
  type: ActivityType
): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case ActivityType.VIEW:
      return 'outline'
    case ActivityType.DOWNLOAD:
      return 'secondary'
    case ActivityType.UPLOAD:
    case ActivityType.NEW_VERSION:
      return 'default'
    default:
      return 'outline'
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function exportToCsv(logs: ActivityLog[]) {
  const header = ['Date & Time', 'User', 'Activity', 'File', 'IP Address']
  const rows = logs.map((log) => [
    formatDateTime(log.timestamp),
    log.userName,
    ACTIVITY_TYPE_LABELS[log.activityType] ?? log.activityType,
    log.fileName,
    log.ipAddress ?? ''
  ])

  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])

  // Server-side filters (trigger refetch)
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Client-side filters (applied to fetched logs)
  const [searchQuery, setSearchQuery] = useState('')
  const [activityFilter, setActivityFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/admin/companies')
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  const fetchActivityLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (companyFilter !== 'all') params.set('companyId', companyFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const url = `/api/admin/activity${params.size > 0 ? `?${params}` : ''}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch activity logs')
      const data = await response.json()
      setLogs(data.logs)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load activity logs. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [companyFilter, startDate, endDate])

  useEffect(() => {
    fetchActivityLogs()
  }, [fetchActivityLogs])

  // Apply client-side filters whenever logs or filter state changes
  useEffect(() => {
    let filtered = logs

    if (activityFilter !== 'all') {
      filtered = filtered.filter((log) => log.activityType === activityFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.userName.toLowerCase().includes(query) ||
          log.fileName.toLowerCase().includes(query)
      )
    }

    setFilteredLogs(filtered)
  }, [searchQuery, activityFilter, logs])

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <h1 className='text-3xl font-bold'>Activity Logs</h1>
        <div className='flex items-center justify-center p-8'>
          <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Activity Logs</h1>

      {/* Compliance dashboard */}
      <ComplianceDashboard />

      {/* Filters */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        {/* Text search */}
        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search user or file…'
            className='pl-8'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Activity type */}
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger>
            <SelectValue placeholder='All activities' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Activities</SelectItem>
            {Object.values(ActivityType).map((type) => (
              <SelectItem key={type} value={type}>
                {ACTIVITY_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Company */}
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger>
            <SelectValue placeholder='All companies' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className='flex gap-2'>
          <Input
            type='date'
            className='flex-1'
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title='From date'
          />
          <Input
            type='date'
            className='flex-1'
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title='To date'
          />
        </div>
      </div>

      {/* Actions row */}
      <div className='flex items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          {filteredLogs.length}{' '}
          {filteredLogs.length === 1 ? 'entry' : 'entries'}
        </p>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => exportToCsv(filteredLogs)}>
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
          <Button onClick={fetchActivityLogs}>Refresh</Button>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center'>
                  No activity logs found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className='whitespace-nowrap'>
                    {formatDateTime(log.timestamp)}
                  </TableCell>
                  <TableCell>{log.userName}</TableCell>
                  <TableCell>
                    <Badge
                      variant={getActivityBadgeVariant(log.activityType)}
                      className='flex items-center gap-1'
                    >
                      {getActivityIcon(log.activityType)}
                      {ACTIVITY_TYPE_LABELS[log.activityType] ??
                        log.activityType}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-xs truncate' title={log.fileName}>
                    {log.fileName}
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
