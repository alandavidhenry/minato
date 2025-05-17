// src/lib/file-system/types.ts
import { ActivityType } from '../activity-logger'

/**
 * File type definitions for consistent use across the application
 */
export interface FileItem {
  name: string
  path: string
  fullPath: string
  isFolder: boolean
  size?: string
  type?: string
  uploadedAt?: string
  hasVersions?: boolean
  versionNumber?: number
  totalVersions?: number
}

/**
 * Result interface for file operations
 */
export interface FileOperationResult {
  success: boolean
  message: string
  data?: {
    newPath?: string
    oldPath?: string
    deletedCount?: number
    copiedCount?: number
    errorCount?: number
    movedCount?: number
    sourcePath?: string
    targetPath?: string
    path?: string
    [key: string]: unknown
  }
  error?: Error
}

/**
 * Activity logging parameters
 */
export interface ActivityLogParams {
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
}

// Re-export ActivityType from activity-logger for convenience
export { ActivityType }
