// src/lib/file-system/file-manager.ts
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

import {
  generateDownloadUrl,
  deleteFile,
  renameFile,
  moveFile
} from './file-operations'
import {
  folderExists,
  createFolder,
  deleteFolder,
  renameFolder,
  moveFolder
} from './folder-operations'
import { formatSize } from './format-utils'
import {
  FOLDER_SEPARATOR,
  FOLDER_MARKER,
  normalizePath,
  isDirectChild
} from './path-utils'
import { FileItem, FileOperationResult } from './types'

/**
 * File Manager class to handle all file and folder operations
 */
export class FileManager {
  private containerClient: ContainerClient

  constructor(connectionString: string, containerName: string) {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient(containerName)
  }

  /**
   * Normalize a path to ensure consistent format
   */
  public normalizePath(path: string): string {
    return normalizePath(path)
  }

  /**
   * Check if a folder exists
   */
  public async folderExists(folderPath: string): Promise<boolean> {
    return folderExists(this.containerClient, folderPath)
  }

  /**
   * Create a folder
   */
  public async createFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return createFolder(this.containerClient, folderPath, userId, userName)
  }

  /**
   * Delete a folder
   */
  public async deleteFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return deleteFolder(this.containerClient, folderPath, userId, userName)
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
    return renameFolder(
      this.containerClient,
      oldPath,
      newName,
      userId,
      userName
    )
  }

  /**
   * Move a folder
   */
  public async moveFolder(
    sourcePath: string,
    targetPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return moveFolder(
      this.containerClient,
      sourcePath,
      targetPath,
      userId,
      userName
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
    return deleteFile(this.containerClient, filePath, userId, userName)
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
    return renameFile(this.containerClient, oldPath, newName, userId, userName)
  }

  /**
   * Generate a download URL for a file
   */
  public async generateDownloadUrl(
    filePath: string,
    expiryMinutes: number = 30
  ): Promise<string | null> {
    return generateDownloadUrl(this.containerClient, filePath, expiryMinutes)
  }

  /**
   * Move a file to another location
   */
  public async moveFile(
    sourcePath: string,
    targetPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return moveFile(
      this.containerClient,
      sourcePath,
      targetPath,
      userId,
      userName
    )
  }

  /**
   * List files and folders in a directory
   */
  public async listContent(path: string = ''): Promise<FileItem[]> {
    try {
      const normalizedPath = normalizePath(path)
      const prefix = normalizedPath
        ? `${normalizedPath}${FOLDER_SEPARATOR}`
        : ''

      const files: FileItem[] = []
      const folders = new Set<string>()

      // List all blobs with the path prefix
      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        // Skip the .folder marker of the current directory
        if (blob.name === `${prefix}${FOLDER_MARKER}`) {
          continue
        }

        // Skip .folder markers for folders
        if (blob.name.endsWith(`${FOLDER_SEPARATOR}${FOLDER_MARKER}`)) {
          // Get the folder path without the marker
          const folderPath = blob.name.substring(
            0,
            blob.name.lastIndexOf(FOLDER_SEPARATOR)
          )

          // Only add folders that are direct children
          if (isDirectChild(folderPath, normalizedPath)) {
            const folderName =
              folderPath.split(FOLDER_SEPARATOR).pop() ?? folderPath
            folders.add(folderName)
          }
          continue
        }

        // For regular files and folders inferred from file paths
        const relativePath = blob.name.substring(prefix.length)

        // Handle files in subfolders
        if (relativePath.includes(FOLDER_SEPARATOR)) {
          // Extract folder name (first segment of the relative path)
          const folderName = relativePath.split(FOLDER_SEPARATOR)[0]

          // Add folder if it's a direct child and not already added
          if (folderName && folderName !== FOLDER_MARKER) {
            folders.add(folderName)
          }
        } else {
          // This is a file in the current directory
          files.push({
            name: relativePath,
            path: normalizedPath,
            fullPath: blob.name,
            isFolder: false,
            size: formatSize(blob.properties.contentLength ?? 0),
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
}

// For server-side usage, create a singleton instance
export function getFileManager(): FileManager {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  return new FileManager(connectionString, containerName)
}
