import { ContainerClient } from '@azure/storage-blob'

import { logActivity } from '../activity-logger'

import {
  normalizePath,
  getFolderMarkerPath,
  isValidName,
  FOLDER_SEPARATOR
} from './path-utils'
import { ActivityType, FileOperationResult } from './types'

async function createFolderMarker(
  containerClient: ContainerClient,
  folderPath: string,
  userId: string
): Promise<void> {
  const markerPath = getFolderMarkerPath(folderPath)
  const content = ''
  await containerClient
    .getBlobClient(markerPath)
    .getBlockBlobClient()
    .upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: 'application/x-directory' },
      metadata: {
        isFolder: 'true',
        createdBy: userId,
        createdAt: new Date().toISOString()
      }
    })
}

export async function folderExists(
  containerClient: ContainerClient,
  folderPath: string
): Promise<boolean> {
  try {
    const markerPath = getFolderMarkerPath(folderPath)
    const blockBlobClient = containerClient.getBlobClient(markerPath)
    return await blockBlobClient.exists()
  } catch (error) {
    console.error('Error checking if folder exists:', folderPath, error)
    return false
  }
}

export async function createFolder(
  containerClient: ContainerClient,
  folderPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(folderPath)

    if (!isValidName(normalizedPath.split('/').pop() ?? '')) {
      return {
        success: false,
        message:
          'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
      }
    }

    if (await folderExists(containerClient, normalizedPath)) {
      return {
        success: false,
        message: `Folder "${normalizedPath}" already exists.`
      }
    }

    await createFolderMarker(containerClient, normalizedPath, userId)

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
    console.error('Error creating folder:', folderPath, error)
    return {
      success: false,
      message: `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export async function deleteFolder(
  containerClient: ContainerClient,
  folderPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(folderPath)
    const prefix = normalizedPath ? `${normalizedPath}${FOLDER_SEPARATOR}` : ''

    if (!(await folderExists(containerClient, normalizedPath))) {
      return {
        success: false,
        message: `Folder "${normalizedPath}" does not exist.`
      }
    }

    let deletedCount = 0
    const blobsToDelete: string[] = []

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobsToDelete.push(blob.name)
    }

    const folderMarkerPath = getFolderMarkerPath(normalizedPath)
    if (await containerClient.getBlobClient(folderMarkerPath).exists()) {
      blobsToDelete.push(folderMarkerPath)
    }

    for (const blobName of blobsToDelete) {
      try {
        await containerClient.getBlobClient(blobName).delete()
        deletedCount++
      } catch (blobError) {
        console.error('Failed to delete blob:', blobName, blobError)
      }
    }

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
    console.error('Error deleting folder:', folderPath, error)
    return {
      success: false,
      message: `Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export async function renameFolder(
  containerClient: ContainerClient,
  oldPath: string,
  newName: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedPath = normalizePath(oldPath)

    if (!isValidName(newName)) {
      return {
        success: false,
        message:
          'Invalid folder name. Folder names cannot include special characters like * ? : < > | and others.'
      }
    }

    if (!(await folderExists(containerClient, normalizedPath))) {
      return {
        success: false,
        message: `Folder "${normalizedPath}" does not exist.`
      }
    }

    const pathParts = normalizedPath.split('/')
    const parentPath =
      pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''
    const newPath = parentPath ? `${parentPath}/${newName}` : newName

    if (await folderExists(containerClient, newPath)) {
      return {
        success: false,
        message: `A folder named "${newName}" already exists.`
      }
    }

    const sourcePrefix = `${normalizedPath}/`
    const targetPrefix = `${newPath}/`

    const blobs: string[] = []
    try {
      for await (const blob of containerClient.listBlobsFlat({
        prefix: sourcePrefix
      })) {
        blobs.push(blob.name)
      }
    } catch (error) {
      console.error('Error listing blobs for folder:', normalizedPath, error)
      return {
        success: false,
        message: `Error listing folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }

    if (blobs.length === 0) {
      await createFolderMarker(containerClient, newPath, userId)

      const markerClient = containerClient.getBlobClient(
        getFolderMarkerPath(normalizedPath)
      )
      if (await markerClient.exists()) {
        await markerClient.delete()
      }

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

    let copiedCount = 0
    let errorCount = 0

    for (const blobName of blobs) {
      try {
        const sourceBlobClient = containerClient.getBlobClient(blobName)
        const relativePath = blobName.substring(sourcePrefix.length)
        const targetBlobClient = containerClient.getBlobClient(
          `${targetPrefix}${relativePath}`
        )

        const copyPoller = await targetBlobClient.beginCopyFromURL(
          sourceBlobClient.url
        )
        const copyResult = await copyPoller.pollUntilDone()

        if (copyResult.copyStatus === 'success') {
          await sourceBlobClient.delete()
          copiedCount++
        } else {
          errorCount++
          console.error(
            'Failed to copy blob during folder rename:',
            blobName,
            'Status:',
            copyResult.copyStatus
          )
        }
      } catch (error) {
        console.error(
          'Error processing blob during folder rename:',
          blobName,
          error
        )
        errorCount++
      }
    }

    await createFolderMarker(containerClient, newPath, userId)

    const sourceMarkerClient = containerClient.getBlobClient(
      getFolderMarkerPath(normalizedPath)
    )
    if (await sourceMarkerClient.exists()) {
      await sourceMarkerClient.delete()
    }

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
    console.error('Error renaming folder from', oldPath, 'to', newName, error)
    return {
      success: false,
      message: `Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export async function moveFolder(
  containerClient: ContainerClient,
  sourcePath: string,
  targetPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedSourcePath = normalizePath(sourcePath)
    const folderName = normalizedSourcePath.split('/').pop() ?? ''

    let normalizedTargetPath: string
    if (targetPath === '') {
      normalizedTargetPath = folderName
    } else if (targetPath.endsWith('/' + folderName)) {
      normalizedTargetPath = normalizePath(targetPath)
    } else {
      normalizedTargetPath = normalizePath(`${targetPath}/${folderName}`)
    }

    if (!(await folderExists(containerClient, normalizedSourcePath))) {
      return {
        success: false,
        message: `Source folder "${normalizedSourcePath}" does not exist.`
      }
    }

    if (await folderExists(containerClient, normalizedTargetPath)) {
      return {
        success: false,
        message: `Destination folder "${normalizedTargetPath}" already exists.`
      }
    }

    const sourcePrefix = `${normalizedSourcePath}/`
    const targetPrefix = `${normalizedTargetPath}/`

    const blobs: string[] = []
    try {
      for await (const blob of containerClient.listBlobsFlat({
        prefix: sourcePrefix
      })) {
        blobs.push(blob.name)
      }
    } catch (error) {
      console.error(
        'Error listing blobs for folder:',
        normalizedSourcePath,
        error
      )
      return {
        success: false,
        message: `Error listing folder contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }

    let movedCount = 0
    let errorCount = 0

    for (const blobName of blobs) {
      try {
        const sourceBlobClient = containerClient.getBlobClient(blobName)
        const relativePath = blobName.substring(sourcePrefix.length)
        const targetBlobClient = containerClient.getBlobClient(
          `${targetPrefix}${relativePath}`
        )

        const copyPoller = await targetBlobClient.beginCopyFromURL(
          sourceBlobClient.url
        )
        const copyResult = await copyPoller.pollUntilDone()

        if (copyResult.copyStatus === 'success') {
          await sourceBlobClient.delete()
          movedCount++
        } else {
          errorCount++
          console.error(
            'Failed to copy blob during folder move:',
            blobName,
            'Status:',
            copyResult.copyStatus
          )
        }
      } catch (error) {
        console.error(
          'Error processing blob during folder move:',
          blobName,
          error
        )
        errorCount++
      }
    }

    await createFolderMarker(containerClient, normalizedTargetPath, userId)

    const sourceMarkerClient = containerClient.getBlobClient(
      getFolderMarkerPath(normalizedSourcePath)
    )
    if (await sourceMarkerClient.exists()) {
      await sourceMarkerClient.delete()
    }

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
      'Error moving folder from',
      sourcePath,
      'to',
      targetPath,
      error
    )
    return {
      success: false,
      message: `Failed to move folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}
