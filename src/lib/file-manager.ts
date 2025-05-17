// src/lib/file-manager.ts
import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  SASProtocol
} from '@azure/storage-blob'

import { logActivity, ActivityType } from './activity-logger'

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
    [key: string]: unknown
  }
  error?: Error
}

/**
 * File Manager class to handle all file and folder operations
 */
export class FileManager {
  private containerClient: ContainerClient
  private folderSeparator: string = '/'
  private folderMarker: string = '.folder'

  constructor(connectionString: string, containerName: string) {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient(containerName)
  }

  /**
   * Normalize a path to ensure consistent format
   */
  public normalizePath(path: string): string {
    // Remove leading and trailing slashes and spaces
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')

    // For root path, return empty string
    if (normalizedPath === '' || normalizedPath === '/') {
      return ''
    }

    return normalizedPath
  }

  /**
   * Get the full path including folder marker if it's a folder
   */
  private getfolderMarkerPath(folderPath: string): string {
    const normalizedPath = this.normalizePath(folderPath)
    return normalizedPath
      ? `${normalizedPath}${this.folderSeparator}${this.folderMarker}`
      : this.folderMarker
  }

  /**
   * Check if a folder exists
   */
  public async folderExists(folderPath: string): Promise<boolean> {
    try {
      const markerPath = this.getfolderMarkerPath(folderPath)
      const blockBlobClient = this.containerClient.getBlobClient(markerPath)
      return await blockBlobClient.exists()
    } catch (error) {
      console.error(`Error checking if folder exists: ${folderPath}`, error)
      return false
    }
  }

  /**
   * Create a folder
   */
  public async createFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    try {
      const normalizedPath = this.normalizePath(folderPath)

      // Validate folder name
      if (!this.isValidName(normalizedPath.split('/').pop() ?? '')) {
        return {
          success: false,
          message:
            'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
        }
      }

      // Check if folder already exists
      if (await this.folderExists(normalizedPath)) {
        return {
          success: false,
          message: `Folder "${normalizedPath}" already exists.`
        }
      }

      // Create folder marker
      const markerPath = this.getfolderMarkerPath(normalizedPath)
      const blockBlobClient = this.containerClient.getBlobClient(markerPath)

      // Upload empty content with folder metadata
      const content = ''
      const options = {
        blobHTTPHeaders: {
          blobContentType: 'application/x-directory'
        },
        metadata: {
          isFolder: 'true',
          createdBy: userId,
          createdAt: new Date().toISOString()
        }
      }
      await blockBlobClient
        .getBlockBlobClient()
        .upload(content, content.length, options)

      // Log the folder creation activity
      await logActivity({
        userId,
        userName,
        fileName: normalizedPath,
        activityType: ActivityType.UPLOAD
      })

      return {
        success: true,
        message: `Folder "${normalizedPath}" created successfully.`,
        data: { path: normalizedPath }
      }
    } catch (error) {
      console.error(`Error creating folder: ${folderPath}`, error)
      return {
        success: false,
        message: `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  /**
   * Validate a file or folder name
   */
  private isValidName(name: string): boolean {
    // Check if the name contains invalid characters
    const invalidChars = /[*?:";|<>\\]/
    return !invalidChars.test(name) && name.trim() !== '' && name.length <= 255
  }

  /**
   * List files and folders in a directory
   */
  public async listContent(path: string = ''): Promise<FileItem[]> {
    try {
      const normalizedPath = this.normalizePath(path)
      const prefix = normalizedPath
        ? `${normalizedPath}${this.folderSeparator}`
        : ''

      const files: FileItem[] = []
      const folders = new Set<string>()

      // List all blobs with the path prefix
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        // Skip the .folder marker of the current directory
        if (blob.name === `${prefix}${this.folderMarker}`) {
          continue
        }

        // Skip .folder markers for folders
        if (blob.name.endsWith(`${this.folderSeparator}${this.folderMarker}`)) {
          // Get the folder path without the marker
          const folderPath = blob.name.substring(
            0,
            blob.name.lastIndexOf(this.folderSeparator)
          )

          // Only add folders that are direct children
          if (this.isDirectChild(folderPath, normalizedPath)) {
            const folderName =
              folderPath.split(this.folderSeparator).pop() ?? folderPath
            folders.add(folderName)
          }
          continue
        }

        // For regular files and folders inferred from file paths
        const relativePath = blob.name.substring(prefix.length)

        // Handle files in subfolders
        if (relativePath.includes(this.folderSeparator)) {
          // Extract folder name (first segment of the relative path)
          const folderName = relativePath.split(this.folderSeparator)[0]

          // Add folder if it's a direct child and not already added
          if (folderName && folderName !== this.folderMarker) {
            folders.add(folderName)
          }
        } else {
          // This is a file in the current directory
          files.push({
            name: relativePath,
            path: normalizedPath,
            fullPath: blob.name,
            isFolder: false,
            size: this.formatSize(blob.properties.contentLength ?? 0),
            type: blob.properties.contentType ?? 'application/octet-stream',
            uploadedAt:
              blob.properties.lastModified?.toLocaleDateString() ??
              new Date().toLocaleDateString()
          })
        }
      }

      // Convert folders set to array of FileItems
      const folderItems = Array.from(folders).map((folderName) => ({
        name: folderName,
        path: normalizedPath,
        fullPath: normalizedPath
          ? `${normalizedPath}/${folderName}`
          : folderName,
        isFolder: true
      }))

      // Return combined result
      return [...folderItems, ...files]
    } catch (error) {
      console.error(`Error listing contents for path: ${path}`, error)
      return []
    }
  }

  /**
   * Format file size into human-readable format
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))

    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Check if a path is a direct child of the current path
   */
  private isDirectChild(path: string, currentPath: string): boolean {
    if (!currentPath) {
      // If current path is root, check if the path has no slashes
      return path.indexOf(this.folderSeparator) === -1
    }

    // Split both paths
    const currentParts = currentPath.split(this.folderSeparator)
    const pathParts = path.split(this.folderSeparator)

    // A direct child has exactly one more segment than the current path
    return (
      pathParts.length === currentParts.length + 1 &&
      path.startsWith(currentPath + this.folderSeparator)
    )
  }

  /**
   * Delete a file
   */
  public async deleteFile(
    filePath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath)

      // Check if file exists
      if (!(await blobClient.exists())) {
        return {
          success: false,
          message: `File "${filePath}" does not exist.`
        }
      }

      // Delete the file
      await blobClient.delete()

      // Log the deletion activity
      await logActivity({
        userId,
        userName,
        fileName: filePath,
        activityType: ActivityType.DELETE
      })

      return {
        success: true,
        message: `File "${filePath}" deleted successfully.`
      }
    } catch (error) {
      console.error(`Error deleting file: ${filePath}`, error)
      return {
        success: false,
        message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  /**
   * Delete a folder and all its contents
   */
  public async deleteFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    try {
      const normalizedPath = this.normalizePath(folderPath)
      const prefix = normalizedPath
        ? `${normalizedPath}${this.folderSeparator}`
        : ''

      // Ensure the folder exists
      if (!(await this.folderExists(normalizedPath))) {
        return {
          success: false,
          message: `Folder "${normalizedPath}" does not exist.`
        }
      }

      let deletedCount = 0
      const blobsToDelete: string[] = []

      // List all blobs in the folder
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        blobsToDelete.push(blob.name)
      }

      // Also add the folder marker
      const folderMarkerPath = this.getfolderMarkerPath(normalizedPath)
      if (await this.containerClient.getBlobClient(folderMarkerPath).exists()) {
        blobsToDelete.push(folderMarkerPath)
      }

      // Delete all blobs
      for (const blobName of blobsToDelete) {
        try {
          await this.containerClient.getBlobClient(blobName).delete()
          deletedCount++
        } catch (blobError) {
          console.error(`Failed to delete blob ${blobName}:`, blobError)
        }
      }

      // Log the folder deletion activity
      await logActivity({
        userId,
        userName,
        fileName: normalizedPath,
        activityType: ActivityType.DELETE
      })

      return {
        success: true,
        message: `Folder "${normalizedPath}" deleted successfully with ${deletedCount} item(s).`,
        data: { deletedCount }
      }
    } catch (error) {
      console.error(`Error deleting folder: ${folderPath}`, error)
      return {
        success: false,
        message: `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  /**
   * Rename a file
   */
  public async renameFile(
    oldPath: string,
    newName: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    try {
      // Validate the new name
      if (!this.isValidName(newName)) {
        return {
          success: false,
          message:
            'Invalid file name. File names cannot include special characters like * ? : < > | and others.'
        }
      }

      // Get source blob and verify it exists
      const sourceBlobClient = this.containerClient.getBlobClient(oldPath)
      if (!(await sourceBlobClient.exists())) {
        return {
          success: false,
          message: `Source file "${oldPath}" does not exist.`
        }
      }

      // Get file extension and parent path
      const fileName = oldPath.split('/').pop() ?? ''
      const extension = fileName.includes('.')
        ? fileName.substring(fileName.lastIndexOf('.'))
        : ''

      const parentPath = oldPath.includes('/')
        ? oldPath.substring(0, oldPath.lastIndexOf('/'))
        : ''

      // Preserve the file extension if it exists
      const newFileName = extension ? `${newName}${extension}` : newName

      // Construct the new path
      const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName

      // Check if destination already exists
      const destBlobClient = this.containerClient.getBlobClient(newPath)
      if (await destBlobClient.exists()) {
        return {
          success: false,
          message: `A file named "${newFileName}" already exists.`
        }
      }

      // Copy the source blob to the destination
      const sourceProperties = await sourceBlobClient.getProperties()
      const copyPoller = await destBlobClient.beginCopyFromURL(
        sourceBlobClient.url
      )
      const copyResult = await copyPoller.pollUntilDone()

      if (copyResult.copyStatus === 'success') {
        // Copy metadata and properties
        if (sourceProperties.metadata) {
          await destBlobClient.setMetadata(sourceProperties.metadata)
        }

        // Delete the original blob after successful copy
        await sourceBlobClient.delete()

        // Log the rename activity
        await logActivity({
          userId,
          userName,
          fileName: newPath,
          activityType: ActivityType.RENAME
        })

        return {
          success: true,
          message: `File renamed from "${fileName}" to "${newFileName}" successfully.`,
          data: { oldPath, newPath }
        }
      } else {
        return {
          success: false,
          message: `Rename operation failed: ${copyResult.copyStatus}`
        }
      }
    } catch (error) {
      console.error(`Error renaming file from ${oldPath} to ${newName}:`, error)
      return {
        success: false,
        message: `Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  /**
   * Rename a folder
   */
  public async renameFolder(
    oldPath: string,
    newName: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    try {
      const normalizedPath = this.normalizePath(oldPath)

      // Validate the new name
      if (!this.isValidName(newName)) {
        return {
          success: false,
          message:
            'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
        }
      }

      // Ensure the folder exists (important: use the normalized path)
      if (!(await this.folderExists(normalizedPath))) {
        return {
          success: false,
          message: `Folder "${normalizedPath}" does not exist.`
        }
      }

      // Determine the parent path and create a new path with the new name
      const pathParts = normalizedPath.split('/')
      const parentPath =
        pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''

      const newPath = parentPath ? `${parentPath}/${newName}` : newName

      // Check if destination already exists
      if (await this.folderExists(newPath)) {
        return {
          success: false,
          message: `A folder named "${newName}" already exists.`
        }
      }

      // Get a list of all blobs in the source folder
      const sourcePrefix = normalizedPath ? `${normalizedPath}/` : ''
      const targetPrefix = newPath ? `${newPath}/` : ''

      // List all blobs with the folder prefix
      const blobs: string[] = []
      try {
        for await (const blob of this.containerClient.listBlobsFlat({
          prefix: sourcePrefix
        })) {
          blobs.push(blob.name)
        }
      } catch (error) {
        console.error(
          `Error listing blobs for folder ${normalizedPath}:`,
          error
        )
        return {
          success: false,
          message: `Error listing folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error : new Error('Unknown error')
        }
      }

      if (blobs.length === 0) {
        // If there are no contents, just create a new empty folder and delete the old marker
        await this.createFolder(newPath, userId, userName)

        // Delete the old folder marker
        const folderMarkerPath = this.getfolderMarkerPath(normalizedPath)
        const markerClient =
          this.containerClient.getBlobClient(folderMarkerPath)
        if (await markerClient.exists()) {
          await markerClient.delete()
        }

        // Log the rename activity
        await logActivity({
          userId,
          userName,
          fileName: newPath,
          activityType: ActivityType.RENAME
        })

        return {
          success: true,
          message: `Empty folder renamed from "${normalizedPath}" to "${newPath}" successfully.`,
          data: { oldPath: normalizedPath, newPath }
        }
      }

      // Process each blob
      let copiedCount = 0
      let errorCount = 0

      for (const blobName of blobs) {
        try {
          const sourceBlobClient = this.containerClient.getBlobClient(blobName)

          // Compute the target blob name by replacing the source prefix with the target prefix
          const relativePath = blobName.substring(sourcePrefix.length)
          const targetBlobName = `${targetPrefix}${relativePath}`
          const targetBlobClient =
            this.containerClient.getBlobClient(targetBlobName)

          // Copy the blob
          const copyPoller = await targetBlobClient.beginCopyFromURL(
            sourceBlobClient.url
          )
          const copyResult = await copyPoller.pollUntilDone()

          if (copyResult.copyStatus === 'success') {
            // Delete the original blob after successful copy
            await sourceBlobClient.delete()
            copiedCount++
          } else {
            errorCount++
            console.error(
              `Failed to copy blob ${blobName} during folder rename. Status: ${copyResult.copyStatus}`
            )
          }
        } catch (error) {
          console.error(
            `Error processing blob ${blobName} during folder rename:`,
            error
          )
          errorCount++
        }
      }

      // Create folder marker in the target location
      await this.createFolder(newPath, userId, userName)

      // Remove the source folder marker
      const sourceFolderMarker = this.getfolderMarkerPath(normalizedPath)
      const markerClient =
        this.containerClient.getBlobClient(sourceFolderMarker)
      if (await markerClient.exists()) {
        await markerClient.delete()
      }

      // Log the rename activity
      await logActivity({
        userId,
        userName,
        fileName: newPath,
        activityType: ActivityType.RENAME
      })

      return {
        success: true,
        message: `Folder renamed from "${normalizedPath}" to "${newPath}" successfully. ${copiedCount} items moved, ${errorCount} errors.`,
        data: { oldPath: normalizedPath, newPath, copiedCount, errorCount }
      }
    } catch (error) {
      console.error(
        `Error renaming folder from ${oldPath} to ${newName}:`,
        error
      )
      return {
        success: false,
        message: `Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  /**
   * Generate a download URL for a file
   */
  public async generateDownloadUrl(
    filePath: string,
    expiryMinutes: number = 30
  ): Promise<string | null> {
    try {
      const blobClient = this.containerClient.getBlobClient(filePath)

      // Check if the blob exists
      if (!(await blobClient.exists())) {
        return null
      }

      // Generate SAS URL with read permission
      const expiresOn = new Date()
      expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes)

      const sasUrl = await blobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'), // Use the proper BlobSASPermissions object
        expiresOn,
        contentDisposition: `attachment; filename="${filePath.split('/').pop()}"`,
        protocol: SASProtocol.Https
      })

      return sasUrl
    } catch (error) {
      console.error(`Error generating download URL for ${filePath}:`, error)
      return null
    }
  }
}

// For server-side usage, create a singleton instance
export function getFileManager(): FileManager {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  return new FileManager(connectionString, containerName)
}
