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

export class FileManager {
  private containerClient: ContainerClient

  constructor(connectionString: string, containerName: string) {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient(containerName)
  }

  public normalizePath(path: string): string {
    return normalizePath(path)
  }

  public async folderExists(folderPath: string): Promise<boolean> {
    return folderExists(this.containerClient, folderPath)
  }

  public async createFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return createFolder(this.containerClient, folderPath, userId, userName)
  }

  public async deleteFolder(
    folderPath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return deleteFolder(this.containerClient, folderPath, userId, userName)
  }

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

  public async deleteFile(
    filePath: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return deleteFile(this.containerClient, filePath, userId, userName)
  }

  public async renameFile(
    oldPath: string,
    newName: string,
    userId: string,
    userName: string
  ): Promise<FileOperationResult> {
    return renameFile(this.containerClient, oldPath, newName, userId, userName)
  }

  public async generateDownloadUrl(
    filePath: string,
    expiryMinutes: number = 30
  ): Promise<string | null> {
    return generateDownloadUrl(this.containerClient, filePath, expiryMinutes)
  }

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

  public async listContent(path: string = ''): Promise<FileItem[]> {
    try {
      const normalizedPath = normalizePath(path)
      const prefix = normalizedPath
        ? `${normalizedPath}${FOLDER_SEPARATOR}`
        : ''

      const files: FileItem[] = []
      const folders = new Set<string>()

      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        if (blob.name === `${prefix}${FOLDER_MARKER}`) {
          continue
        }

        if (blob.name.endsWith(`${FOLDER_SEPARATOR}${FOLDER_MARKER}`)) {
          const folderPath = blob.name.substring(
            0,
            blob.name.lastIndexOf(FOLDER_SEPARATOR)
          )

          if (isDirectChild(folderPath, normalizedPath)) {
            const folderName =
              folderPath.split(FOLDER_SEPARATOR).pop() ?? folderPath
            folders.add(folderName)
          }
          continue
        }

        const relativePath = blob.name.substring(prefix.length)

        if (relativePath.includes(FOLDER_SEPARATOR)) {
          const folderName = relativePath.split(FOLDER_SEPARATOR)[0]
          if (folderName && folderName !== FOLDER_MARKER) {
            folders.add(folderName)
          }
        } else {
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

      const folderItems = Array.from(folders).map((folderName) => ({
        name: folderName,
        path: normalizedPath,
        fullPath: normalizedPath
          ? `${normalizedPath}/${folderName}`
          : folderName,
        isFolder: true
      }))

      return [...folderItems, ...files]
    } catch (error) {
      console.error(`Error listing contents for path: ${path}`, error)
      return []
    }
  }
}

export function getFileManager(): FileManager {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
  return new FileManager(connectionString, containerName)
}
