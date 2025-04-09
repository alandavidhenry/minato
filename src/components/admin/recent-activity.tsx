// src/components/admin/recent-activity.tsx
'use client'

import { Clock, Download, Eye, FileUp } from 'lucide-react'
import { useState, useEffect } from 'react'

import { ActivityType } from '@/lib/activity-logger'

interface ActivityLog {
  id: string
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
  timestamp: string
}

// Create unique IDs for loading placeholders that don't change between renders
const LOADING_PLACEHOLDER_IDS = [
  'loading-placeholder-a',
  'loading-placeholder-b',
  'loading-placeholder-c',
  'loading-placeholder-d',
  'loading-placeholder-e'
]

export function RecentActivity() {
  const [isLoading, setIsLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityLog[]>([])

  useEffect(() => {
    async function fetchRecentActivity() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/admin/activity?limit=5')
        if (response.ok) {
          const data = await response.json()
          setActivities(data.logs)
        }
      } catch (error) {
        console.error('Error fetching recent activity:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecentActivity()
  }, [])

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
        return <Clock className='h-4 w-4' />
    }
  }

  // Format activity type for display
  function formatActivityType(type: ActivityType): string {
    switch (type) {
      case ActivityType.VIEW:
        return 'viewed'
      case ActivityType.DOWNLOAD:
        return 'downloaded'
      case ActivityType.UPLOAD:
        return 'uploaded'
      case ActivityType.NEW_VERSION:
        return 'updated'
      default:
        return type
    }
  }

  // Format datetime to relative time
  function formatRelativeTime(dateTimeString: string): string {
    const date = new Date(dateTimeString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {/* Using pre-defined unique IDs instead of array indices */}
        {LOADING_PLACEHOLDER_IDS.map((id) => (
          <div key={id} className='flex items-center gap-2'>
            <div className='h-8 w-8 animate-pulse rounded-full bg-muted'></div>
            <div className='flex-1'>
              <div className='h-4 w-full animate-pulse rounded bg-muted'></div>
              <div className='mt-1 h-3 w-24 animate-pulse rounded bg-muted'></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return <p className='text-muted-foreground'>No recent activity found.</p>
  }

  return (
    <div className='space-y-3'>
      {activities.map((activity) => (
        <div
          key={activity.id}
          className='flex items-start gap-2 border-b pb-2 last:border-b-0'
        >
          <span className='mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-muted'>
            {getActivityIcon(activity.activityType)}
          </span>
          <div className='flex-1'>
            <p className='text-sm'>
              <span className='font-semibold'>{activity.userName}</span>{' '}
              {formatActivityType(activity.activityType)}{' '}
              <span className='font-medium text-muted-foreground'>
                {activity.fileName}
              </span>
            </p>
            <p className='text-xs text-muted-foreground'>
              {formatRelativeTime(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
      <div className='text-right'>
        <a
          href='/admin/activity'
          className='text-xs text-primary hover:underline'
        >
          View all activity →
        </a>
      </div>
    </div>
  )
}
