import {
  BlobSASPermissions,
  ContainerClient,
  SASProtocol
} from '@azure/storage-blob'

import { logActivity, ActivityType } from '../activity-logger'
import { parseFileName } from '../version-manager'

import { isValidName, normalizePath } from './path-utils'
import { FileOperationResult } from './types'

export async function deleteFile(
  containerClient: ContainerClient,
  filePath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const { baseName } = parseFileName(filePath)

    // Scope the scan to the same folder so we don't walk the whole container
    const lastSlash = filePath.lastIndexOf('/')
    const prefix = lastSlash > 0 ? filePath.substring(0, lastSlash + 1) : ''

    // Collect every blob that belongs to this document (all versions)
    const toDelete: string[] = []
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const { baseName: blobBase } = parseFileName(blob.name)
      if (blobBase === baseName) {
        toDelete.push(blob.name)
      }
    }

    if (toDelete.length === 0) {
      return {
        success: false,
        message: `File "${filePath}" does not exist.`
      }
    }

    for (const blobPath of toDelete) {
      await containerClient.getBlobClient(blobPath).delete()
    }

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
    console.error('Error deleting file:', filePath, ':', error)
    return {
      success: false,
      message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export async function renameFile(
  containerClient: ContainerClient,
  oldPath: string,
  newName: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    if (!isValidName(newName)) {
      return {
        success: false,
        message:
          'Invalid file name. File names cannot include special characters like * ? : < > | and others.'
      }
    }

    const sourceBlobClient = containerClient.getBlobClient(oldPath)
    if (!(await sourceBlobClient.exists())) {
      return {
        success: false,
        message: `Source file "${oldPath}" does not exist.`
      }
    }

    const fileName = oldPath.split('/').pop() ?? ''
    const extension = fileName.includes('.')
      ? fileName.substring(fileName.lastIndexOf('.'))
      : ''
    const parentPath = oldPath.includes('/')
      ? oldPath.substring(0, oldPath.lastIndexOf('/'))
      : ''

    const newFileName = extension ? `${newName}${extension}` : newName
    const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName

    const destBlobClient = containerClient.getBlobClient(newPath)
    if (await destBlobClient.exists()) {
      return {
        success: false,
        message: `A file named "${newFileName}" already exists.`
      }
    }

    const sourceProperties = await sourceBlobClient.getProperties()
    const copyPoller = await destBlobClient.beginCopyFromURL(
      sourceBlobClient.url
    )
    const copyResult = await copyPoller.pollUntilDone()

    if (copyResult.copyStatus !== 'success') {
      return {
        success: false,
        message: `Rename operation failed: ${copyResult.copyStatus}`
      }
    }

    if (sourceProperties.metadata) {
      await destBlobClient.setMetadata(sourceProperties.metadata)
    }

    await sourceBlobClient.delete()

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
  } catch (error) {
    console.error(
      'Error renaming file from',
      oldPath,
      'to',
      newName,
      ':',
      error
    )
    return {
      success: false,
      message: `Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export async function generateDownloadUrl(
  containerClient: ContainerClient,
  filePath: string,
  expiryMinutes: number = 30
): Promise<string | null> {
  try {
    const blobClient = containerClient.getBlobClient(filePath)

    if (!(await blobClient.exists())) {
      return null
    }

    const expiresOn = new Date()
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes)

    return blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
      contentDisposition: `attachment; filename="${filePath.split('/').pop()}"`,
      protocol: SASProtocol.Https
    })
  } catch (error) {
    console.error('Error generating download URL for', filePath, ':', error)
    return null
  }
}

export async function moveFile(
  containerClient: ContainerClient,
  sourcePath: string,
  targetPath: string,
  userId: string,
  userName: string
): Promise<FileOperationResult> {
  try {
    const normalizedSourcePath = normalizePath(sourcePath)
    const filename = normalizedSourcePath.split('/').pop() ?? ''

    let normalizedTargetPath: string
    if (!targetPath) {
      normalizedTargetPath = filename
    } else if (targetPath.endsWith('/' + filename) || targetPath === filename) {
      normalizedTargetPath = normalizePath(targetPath)
    } else {
      normalizedTargetPath = normalizePath(`${targetPath}/${filename}`)
    }

    const sourceBlobClient = containerClient.getBlobClient(normalizedSourcePath)

    if (!(await sourceBlobClient.exists())) {
      return {
        success: false,
        message: `Source file "${normalizedSourcePath}" does not exist.`
      }
    }

    const destBlobClient = containerClient.getBlobClient(normalizedTargetPath)

    if (await destBlobClient.exists()) {
      return {
        success: false,
        message: `A file with name "${normalizedTargetPath}" already exists.`
      }
    }

    const sourceProperties = await sourceBlobClient.getProperties()
    const copyPoller = await destBlobClient.beginCopyFromURL(
      sourceBlobClient.url
    )
    const copyResult = await copyPoller.pollUntilDone()

    if (copyResult.copyStatus !== 'success') {
      return {
        success: false,
        message: `Move operation failed with status: ${copyResult.copyStatus}`
      }
    }

    if (sourceProperties.metadata) {
      try {
        await destBlobClient.setMetadata(sourceProperties.metadata)
      } catch (error) {
        // Non-fatal: log and continue
        console.warn(
          'Warning: Could not copy metadata for %s',
          normalizedTargetPath,
          error
        )
      }
    }

    await sourceBlobClient.delete()

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
