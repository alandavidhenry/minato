// src/lib/activity-logger.ts
import { TableClient } from '@azure/data-tables'

export enum ActivityType {
  VIEW = 'view',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  NEW_VERSION = 'new_version',
  RENAME = 'rename'
}

export interface ActivityLog {
  id: string
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
  timestamp: string
  ipAddress?: string
}

interface ActivityLogError {
  statusCode?: number
  [key: string]: unknown
}

// Get a TableClient instance for the activity logs table
function getTableClient() {
  // For local development with Azurite
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'activityLogs'
    )
  }

  // For production, use your Azure Storage account
  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'activityLogs'
  )
}

// Initialize the table if it doesn't exist
export async function initActivityLogsTable() {
  const tableClient = getTableClient()
  try {
    await tableClient.createTable()
  } catch (error) {
    const activityLogError = error as ActivityLogError
    // If the table already exists, that's fine
    if (activityLogError.statusCode === 409) {
      return
    }
    console.error('Error creating activity logs table:', error)
  }
}

// Log a user activity
export async function logActivity(
  activity: Omit<ActivityLog, 'id' | 'timestamp'>
) {
  const tableClient = getTableClient()

  try {
    // Create a unique ID for the activity log
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const timestamp = new Date().toISOString()

    // Check if userId is provided
    if (!activity.userId) {
      console.error('Missing userId in activity log')
      activity.userId = 'unknown-user'
    }

    // Create the activity log entity
    const logEntity = {
      partitionKey: activity.userId,
      rowKey: id,
      userId: activity.userId,
      userName: activity.userName,
      fileName: activity.fileName,
      activityType: activity.activityType,
      timestamp,
      ipAddress: activity.ipAddress ?? ''
    }

    // Save to Azure Table Storage
    await tableClient.createEntity(logEntity)

    return {
      id,
      ...activity,
      timestamp
    }
  } catch (error) {
    console.error('Error logging activity:', error)
    return null
  }
}

// Get activity logs for all users or a specific user
export async function getActivityLogs(userId?: string): Promise<ActivityLog[]> {
  const tableClient = getTableClient()
  const logs: ActivityLog[] = []

  try {
    // If userId is provided, filter by that user
    const queryOptions = userId
      ? { queryOptions: { filter: `PartitionKey eq '${userId}'` } }
      : undefined

    const iterator = tableClient.listEntities(queryOptions)

    for await (const entity of iterator) {
      logs.push({
        id: entity.rowKey as string,
        userId: entity.userId as string,
        userName: entity.userName as string,
        fileName: entity.fileName as string,
        activityType: entity.activityType as ActivityType,
        timestamp: entity.timestamp as string,
        ipAddress: entity.ipAddress as string
      })
    }

    // Sort by timestamp, newest first
    return logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  } catch (error) {
    console.error('Error getting activity logs:', error)
    return []
  }
}

// Get recent activity logs (limited number, sorted by timestamp)
export async function getRecentActivityLogs(
  limit: number = 5
): Promise<ActivityLog[]> {
  const allLogs = await getActivityLogs()

  // Return only the most recent logs, limited by the specified number
  return allLogs.slice(0, limit)
}
