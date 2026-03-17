// src/lib/file-system/file-operations.ts
import {
  BlobSASPermissions,
  ContainerClient,
  SASProtocol
} from '@azure/storage-blob'

import { logActivity, ActivityType } from '../activity-logger'

import { isValidName, normalizePath } from './path-utils'
import { FileOperationResult } from './types'

/**
 * Delete a file
 */
export async function deleteFile(
  containerClient: ContainerClient,
  filePath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const blobClient = containerClient.getBlobClient(filePath)

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
 * Rename a file
 */
export async function renameFile(
  containerClient: ContainerClient,
  oldPath: string,
  newName: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    // Validate the new name
    if (!isValidName(newName)) {
      return {
        success: false,
        message:
          'Invalid file name. File names cannot include special characters like * ? : < > | and others.'
      }
    }

    // Get source blob and verify it exists
    const sourceBlobClient = containerClient.getBlobClient(oldPath)
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
    const destBlobClient = containerClient.getBlobClient(newPath)
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
 * Generate a download URL for a file
 */
export async function generateDownloadUrl(
  containerClient: ContainerClient,
  filePath: string,
  expiryMinutes: number = 30
): Promise<string | null> {
  try {
    const blobClient = containerClient.getBlobClient(filePath)

    // Check if the blob exists
    if (!(await blobClient.exists())) {
      return null
    }

    // Generate SAS URL with read permission
    const expiresOn = new Date()
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes)

    const sasUrl = await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
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

/**
 * Move a file to another location
 */
export async function moveFile(
  containerClient: ContainerClient,
  sourcePath: string,
  targetPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    // Normalize paths
    const normalizedSourcePath = normalizePath(sourcePath)

    // Extract the filename from the source path
    const filename = normalizedSourcePath.split('/').pop() ?? ''

    // Determine target path
    let normalizedTargetPath
    if (!targetPath) {
      // Moving to root - just use filename
      normalizedTargetPath = filename
    } else {
      // Check if target path already includes the filename
      if (targetPath.endsWith('/' + filename) || targetPath === filename) {
        normalizedTargetPath = normalizePath(targetPath)
      } else {
        // Add filename to target path
        normalizedTargetPath = normalizePath(`${targetPath}/${filename}`)
      }
    }

    // Get source blob and verify it exists
    const sourceBlobClient = containerClient.getBlobClient(normalizedSourcePath)
    let sourceExists = false

    try {
      sourceExists = await sourceBlobClient.exists()
    } catch (error) {
      console.error(
        `Error checking if source exists: ${normalizedSourcePath}`,
        error
      )
      return {
        success: false,
        message: `Error checking if source file exists: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    if (!sourceExists) {
      return {
        success: false,
        message: `Source file "${normalizedSourcePath}" does not exist.`
      }
    }

    // Check if destination already exists
    const destBlobClient = containerClient.getBlobClient(normalizedTargetPath)
    let destExists = false

    try {
      destExists = await destBlobClient.exists()
    } catch (error) {
      console.error(
        `Error checking if destination exists: ${normalizedTargetPath}`,
        error
      )
      return {
        success: false,
        message: `Error checking if destination file exists: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    if (destExists) {
      return {
        success: false,
        message: `A file with name "${normalizedTargetPath}" already exists.`
      }
    }

    // Copy the source blob to the destination
    let sourceProperties
    try {
      sourceProperties = await sourceBlobClient.getProperties()
    } catch (error) {
      console.error(
        `Error getting source properties: ${normalizedSourcePath}`,
        error
      )
      return {
        success: false,
        message: `Error getting source file properties: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    let copyResult
    try {
      const copyPoller = await destBlobClient.beginCopyFromURL(
        sourceBlobClient.url
      )
      copyResult = await copyPoller.pollUntilDone()
    } catch (error) {
      console.error(
        `Error copying file: ${normalizedSourcePath} -> ${normalizedTargetPath}`,
        error
      )
      return {
        success: false,
        message: `Error copying file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }

    if (copyResult.copyStatus === 'success') {
      // Copy metadata and properties
      if (sourceProperties.metadata) {
        try {
          await destBlobClient.setMetadata(sourceProperties.metadata)
        } catch (error) {
          console.warn(
            `Warning: Could not copy metadata for ${normalizedTargetPath}`,
            error
          )
          // Don't fail the operation for metadata issues
        }
      }

      // Delete the original blob after successful copy
      try {
        await sourceBlobClient.delete()
      } catch (error) {
        console.error(
          `Error deleting source after copy: ${normalizedSourcePath}`,
          error
        )
        return {
          success: false,
          message: `File copied to new location, but failed to delete the original: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }

      // Log the move activity
      await logActivity({
        userId,
        userName,
        fileName: normalizedTargetPath,
        activityType: ActivityType.MOVE
      })

      return {
        success: true,
        message: `File moved from "${normalizedSourcePath}" to "${normalizedTargetPath}" successfully.`,
        data: {
          sourcePath: normalizedSourcePath,
          targetPath: normalizedTargetPath
        }
      }
    } else {
      return {
        success: false,
        message: `Move operation failed with status: ${copyResult.copyStatus}`
      }
    }
  } catch (error) {
    console.error(
      `Error moving file from ${sourcePath} to ${targetPath}:`,
      error
    )
    return {
      success: false,
      message: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}
