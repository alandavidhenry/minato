import { ActivityType } from '@/lib/activity-logger'

interface ActivityLog {
  id: string
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
  timestamp: string
}

interface ChartData {
  dailyActivity: Array<{ date: string; count: number }>
  activityByType: Array<{ name: string; value: number }>
  activityByUser: Array<{ name: string; value: number }>
}

export function formatActivityType(type: ActivityType): string {
  switch (type) {
    case ActivityType.VIEW:
      return 'View'
    case ActivityType.DOWNLOAD:
      return 'Download'
    case ActivityType.UPLOAD:
      return 'Upload'
    case ActivityType.NEW_VERSION:
      return 'New Version'
    default:
      return type
  }
}

export function processActivityData(logs: ActivityLog[]): ChartData {
  if (logs.length === 0) {
    return {
      dailyActivity: [],
      activityByType: [],
      activityByUser: []
    }
  }

  // Group by date for daily activity
  const dailyGroups: Record<string, { date: string; count: number }> = {}

  // Group by activity type
  const typeGroups: Record<string, { name: string; value: number }> = {}

  // Group by user
  const userGroups: Record<string, { name: string; value: number }> = {}

  // Process all logs
  logs.forEach((log) => {
    // Process daily activity
    const date = new Date(log.timestamp).toLocaleDateString()
    if (!dailyGroups[date]) {
      dailyGroups[date] = { date, count: 0 }
    }
    dailyGroups[date].count++

    // Process activity types
    if (!typeGroups[log.activityType]) {
      typeGroups[log.activityType] = {
        name: formatActivityType(log.activityType),
        value: 0
      }
    }
    typeGroups[log.activityType].value++

    // Process users
    if (!userGroups[log.userId]) {
      userGroups[log.userId] = { name: log.userName, value: 0 }
    }
    userGroups[log.userId].value++
  })

  // Convert to arrays and sort
  const dailyActivity = Object.values(dailyGroups).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  const activityByType = Object.values(typeGroups)

  // Get top 5 most active users
  const topUsers = Object.values(userGroups)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return {
    dailyActivity,
    activityByType,
    activityByUser: topUsers
  }
}
