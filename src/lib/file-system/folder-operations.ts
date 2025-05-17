// src/lib/file-system/folder-operations.ts
import { ContainerClient } from '@azure/storage-blob'

import { logActivity } from '../activity-logger'

import {
  normalizePath,
  getFolderMarkerPath,
  isValidName,
  FOLDER_SEPARATOR
} from './path-utils'
import { ActivityType, FileOperationResult } from './types'

/**
 * Check if a folder exists
 */
export async function folderExists(
  containerClient: ContainerClient,
  folderPath: string
): Promise<boolean> {
  try {
    const markerPath = getFolderMarkerPath(folderPath)
    const blockBlobClient = containerClient.getBlobClient(markerPath)
    return await blockBlobClient.exists()
  } catch (error) {
    console.error(`Error checking if folder exists: ${folderPath}`, error)
    return false
  }
}

/**
 * Create a folder
 */
export async function createFolder(
  containerClient: ContainerClient,
  folderPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(folderPath)

    // Validate folder name
    if (!isValidName(normalizedPath.split('/').pop() ?? '')) {
      return {
        success: false,
        message:
          'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
      }
    }

    // Check if folder already exists
    if (await folderExists(containerClient, normalizedPath)) {
      return {
        success: false,
        message: `Folder "${normalizedPath}" already exists.`
      }
    }

    // Create folder marker
    const markerPath = getFolderMarkerPath(normalizedPath)
    const blockBlobClient = containerClient.getBlobClient(markerPath)

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
 * Delete a folder and all its contents
 */
export async function deleteFolder(
  containerClient: ContainerClient,
  folderPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(folderPath)
    const prefix = normalizedPath ? `${normalizedPath}${FOLDER_SEPARATOR}` : ''

    // Ensure the folder exists
    if (!(await folderExists(containerClient, normalizedPath))) {
      return {
        success: false,
        message: `Folder "${normalizedPath}" does not exist.`
      }
    }

    let deletedCount = 0
    const blobsToDelete: string[] = []

    // List all blobs in the folder
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobsToDelete.push(blob.name)
    }

    // Also add the folder marker
    const folderMarkerPath = getFolderMarkerPath(normalizedPath)
    if (await containerClient.getBlobClient(folderMarkerPath).exists()) {
      blobsToDelete.push(folderMarkerPath)
    }

    // Delete all blobs
    for (const blobName of blobsToDelete) {
      try {
        await containerClient.getBlobClient(blobName).delete()
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
 * Rename a folder
 */
export async function renameFolder(
  containerClient: ContainerClient,
  oldPath: string,
  newName: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(oldPath)

    // Validate the new name
    if (!isValidName(newName)) {
      return {
        success: false,
        message:
          'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
      }
    }

    // Ensure the folder exists
    if (!(await folderExists(containerClient, normalizedPath))) {
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
    if (await folderExists(containerClient, newPath)) {
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
      for await (const blob of containerClient.listBlobsFlat({
        prefix: sourcePrefix
      })) {
        blobs.push(blob.name)
      }
    } catch (error) {
      console.error(`Error listing blobs for folder ${normalizedPath}:`, error)
      return {
        success: false,
        message: `Error listing folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }

    if (blobs.length === 0) {
      // If there are no contents, just create a new empty folder and delete the old marker
      await createFolder(containerClient, newPath, userId, userName)

      // Delete the old folder marker
      const folderMarkerPath = getFolderMarkerPath(normalizedPath)
      const markerClient = containerClient.getBlobClient(folderMarkerPath)

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
        const sourceBlobClient = containerClient.getBlobClient(blobName)

        // Compute the target blob name by replacing the source prefix with the target prefix
        const relativePath = blobName.substring(sourcePrefix.length)
        const targetBlobName = `${targetPrefix}${relativePath}`
        const targetBlobClient = containerClient.getBlobClient(targetBlobName)

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
    await createFolder(containerClient, newPath, userId, userName)

    // Remove the source folder marker
    const sourceFolderMarker = getFolderMarkerPath(normalizedPath)
    const markerClient = containerClient.getBlobClient(sourceFolderMarker)

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
    console.error(`Error renaming folder from ${oldPath} to ${newName}:`, error)
    return {
      success: false,
      message: `Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

/**
 * Move a folder and all its contents to another location
 */
export async function moveFolder(
  containerClient: ContainerClient,
  sourcePath: string,
  targetPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedSourcePath = normalizePath(sourcePath)

    // Extract folder name
    const folderName = normalizedSourcePath.split('/').pop() ?? ''

    // Handle the target path differently based on context
    let normalizedTargetPath

    if (targetPath === '') {
      // Moving to root - keep the folder name
      normalizedTargetPath = folderName
    } else if (targetPath.endsWith('/' + folderName)) {
      // Target already includes the folder name
      normalizedTargetPath = normalizePath(targetPath)
    } else {
      // Target is a different folder - append the folder name
      normalizedTargetPath = normalizePath(`${targetPath}/${folderName}`)
    }

    // Ensure the source folder exists
    if (!(await folderExists(containerClient, normalizedSourcePath))) {
      return {
        success: false,
        message: `Source folder "${normalizedSourcePath}" does not exist.`
      }
    }

    // Check if destination folder already exists
    if (await folderExists(containerClient, normalizedTargetPath)) {
      return {
        success: false,
        message: `Destination folder "${normalizedTargetPath}" already exists.`
      }
    }

    // Get a list of all blobs in the source folder
    const sourcePrefix = normalizedSourcePath ? `${normalizedSourcePath}/` : ''
    const targetPrefix = normalizedTargetPath ? `${normalizedTargetPath}/` : ''

    // List all blobs with the folder prefix
    const blobs: string[] = []
    try {
      for await (const blob of containerClient.listBlobsFlat({
        prefix: sourcePrefix
      })) {
        blobs.push(blob.name)
      }
    } catch (error) {
      console.error(
        `Error listing blobs for folder ${normalizedSourcePath}:`,
        error
      )
      return {
        success: false,
        message: `Error listing folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }

    // Process each blob
    let movedCount = 0
    let errorCount = 0

    for (const blobName of blobs) {
      try {
        const sourceBlobClient = containerClient.getBlobClient(blobName)

        // Compute the target blob name by replacing the source prefix with the target prefix
        const relativePath = blobName.substring(sourcePrefix.length)
        const targetBlobName = `${targetPrefix}${relativePath}`
        const targetBlobClient = containerClient.getBlobClient(targetBlobName)

        // Copy the blob
        const copyPoller = await targetBlobClient.beginCopyFromURL(
          sourceBlobClient.url
        )
        const copyResult = await copyPoller.pollUntilDone()

        if (copyResult.copyStatus === 'success') {
          // Delete the original blob after successful copy
          await sourceBlobClient.delete()
          movedCount++
        } else {
          errorCount++
          console.error(
            `Failed to copy blob ${blobName} during folder move. Status: ${copyResult.copyStatus}`
          )
        }
      } catch (error) {
        console.error(
          `Error processing blob ${blobName} during folder move:`,
          error
        )
        errorCount++
      }
    }

    // Create folder marker in the target location
    await createFolder(containerClient, normalizedTargetPath, userId, userName)

    // Remove the source folder marker
    const sourceFolderMarker = getFolderMarkerPath(normalizedSourcePath)
    const markerClient = containerClient.getBlobClient(sourceFolderMarker)
    if (await markerClient.exists()) {
      await markerClient.delete()
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
      message: `Folder moved from "${normalizedSourcePath}" to "${normalizedTargetPath}" successfully. ${movedCount} items moved, ${errorCount} errors.`,
      data: {
        sourcePath: normalizedSourcePath,
        targetPath: normalizedTargetPath,
        movedCount,
        errorCount
      }
    }
  } catch (error) {
    console.error(
      `Error moving folder from ${sourcePath} to ${targetPath}:`,
      error
    )
    return {
      success: false,
      message: `Failed to move folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}
