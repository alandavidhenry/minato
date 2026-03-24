import { randomBytes } from 'crypto'

import { TableClient } from '@azure/data-tables'

export enum ActivityType {
  VIEW = 'view',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  NEW_VERSION = 'new_version',
  RENAME = 'rename',
  DELETE = 'delete',
  MOVE = 'move'
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

function getTableClient() {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'activityLogs'
    )
  }

  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'activityLogs'
  )
}

export async function initActivityLogsTable() {
  const tableClient = getTableClient()
  try {
    await tableClient.createTable()
  } catch (error) {
    const activityLogError = error as ActivityLogError
    if (activityLogError.statusCode === 409) {
      return
    }
    console.error('Error creating activity logs table:', error)
  }
}

export async function logActivity(
  activity: Omit<ActivityLog, 'id' | 'timestamp'>
) {
  const tableClient = getTableClient()

  try {
    const id = `${Date.now()}_${randomBytes(4).toString('hex')}`
    const timestamp = new Date().toISOString()
    const userId = activity.userId || 'unknown-user'

    if (!activity.userId) {
      console.error('Missing userId in activity log')
    }

    await tableClient.createEntity({
      partitionKey: userId,
      rowKey: id,
      userId,
      userName: activity.userName,
      fileName: activity.fileName,
      activityType: activity.activityType,
      timestamp,
      ipAddress: activity.ipAddress ?? ''
    })

    return { id, ...activity, userId, timestamp }
  } catch (error) {
    console.error('Error logging activity:', error)
    return null
  }
}

export async function getActivityLogs(userId?: string): Promise<ActivityLog[]> {
  const tableClient = getTableClient()
  const logs: ActivityLog[] = []

  try {
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

export async function getRecentActivityLogs(
  limit: number = 5
): Promise<ActivityLog[]> {
  const allLogs = await getActivityLogs()
  return allLogs.slice(0, limit)
}
