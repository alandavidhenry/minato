// src/app/admin/activity/page.tsx
'use client'

import { Download, Eye, FileUp, Search } from 'lucide-react'
import { useState, useEffect } from 'react'

import { ActivityDashboard } from '@/components/admin/activity-dashboard'
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

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activityFilter, setActivityFilter] = useState<string>('all')

  // Fetch activity logs on component mount
  useEffect(() => {
    fetchActivityLogs()
  }, [])

  // Filter logs when search query or activity filter changes
  useEffect(() => {
    // Filter logs based on search query and activity type
    function filterLogs() {
      let filtered = logs

      // Filter by activity type
      if (activityFilter !== 'all') {
        filtered = filtered.filter((log) => log.activityType === activityFilter)
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (log) =>
            log.userName.toLowerCase().includes(query) ||
            log.fileName.toLowerCase().includes(query)
        )
      }

      setFilteredLogs(filtered)
    }

    filterLogs()
  }, [searchQuery, activityFilter, logs])

  // Function to fetch activity logs from API
  async function fetchActivityLogs() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/activity')
      if (!response.ok) {
        throw new Error('Failed to fetch activity logs')
      }
      const data = await response.json()
      setLogs(data.logs)
      setFilteredLogs(data.logs)
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      toast({
        title: 'Error',
        description: 'Failed to load activity logs. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get icon for activity type
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

  // Get badge variant for activity type
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

  // Format activity type for display
  function formatActivityType(type: ActivityType): string {
    switch (type) {
      case ActivityType.VIEW:
        return 'Viewed'
      case ActivityType.DOWNLOAD:
        return 'Downloaded'
      case ActivityType.UPLOAD:
        return 'Uploaded'
      case ActivityType.NEW_VERSION:
        return 'New Version'
      default:
        return type
    }
  }

  // Format datetime for display
  function formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString)
    return date.toLocaleString()
  }

  // Render loading state
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

      {/* Aactivity dashboard */}
      <ActivityDashboard logs={logs} />

      {/* Search & Filter */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4'>
        <div className='relative flex-1 w-full'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search by user or file...'
            className='pl-8 w-full'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className='w-full sm:w-[180px]'>
            <SelectValue placeholder='Filter by activity' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Activities</SelectItem>
            <SelectItem value={ActivityType.VIEW}>View</SelectItem>
            <SelectItem value={ActivityType.DOWNLOAD}>Download</SelectItem>
            <SelectItem value={ActivityType.UPLOAD}>Upload</SelectItem>
            <SelectItem value={ActivityType.NEW_VERSION}>
              New Version
            </SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchActivityLogs}>Refresh</Button>
      </div>

      {/* Activity Logs Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
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
                      {formatActivityType(log.activityType)}
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
