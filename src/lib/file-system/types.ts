import { ActivityType } from '../activity-logger'

export { ActivityType }

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
