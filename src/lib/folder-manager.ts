// src/lib/folder-manager.ts
import { BlobServiceClient } from '@azure/storage-blob'

/**
 * Creates an empty folder in blob storage
 * (Azure Blob Storage doesn't have real folders, so we create a placeholder file)
 */
export async function createEmptyFolder(folderPath: string): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  // Add trailing slash if not present and add .folder placeholder
  const normalizedPath = folderPath.endsWith('/')
    ? folderPath
    : `${folderPath}/`

  const placeholderPath = `${normalizedPath}.folder`

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blockBlobClient = containerClient.getBlockBlobClient(placeholderPath)

  // Upload empty content with folder metadata
  await blockBlobClient.upload('', 0, {
    blobHTTPHeaders: {
      blobContentType: 'application/x-directory'
    },
    metadata: {
      isFolder: 'true'
    }
  })

  return folderPath
}

/**
 * Checks if a folder exists by checking for the placeholder file
 */
export async function folderExists(folderPath: string): Promise<boolean> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  // Add trailing slash if not present and add .folder placeholder
  const normalizedPath = folderPath.endsWith('/')
    ? folderPath
    : `${folderPath}/`

  const placeholderPath = `${normalizedPath}.folder`

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blockBlobClient = containerClient.getBlockBlobClient(placeholderPath)

  const exists = await blockBlobClient.exists()

  return exists
}

/**
 * Move or copy a folder and its contents
 * (Operation can be 'move' or 'copy')
 */
export async function moveOrCopyFolder(
  sourceFolderPath: string,
  targetPath: string,
  operation: 'move' | 'copy'
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  // Add trailing slash if not present
  const sourcePrefix = sourceFolderPath.endsWith('/')
    ? sourceFolderPath
    : `${sourceFolderPath}/`

  const targetPrefix = targetPath
    ? targetPath.endsWith('/')
      ? targetPath
      : `${targetPath}/`
    : ''

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Get all blobs in the source folder
    const blobs: string[] = []
    for await (const blob of containerClient.listBlobsFlat({
      prefix: sourcePrefix
    })) {
      blobs.push(blob.name)
    }

    if (blobs.length === 0) {
      return null
    }

    // Process each blob
    for (const blobName of blobs) {
      const sourceBlobClient = containerClient.getBlobClient(blobName)

      // Compute the target blob name by replacing the source prefix with the target prefix
      const relativePath = blobName.substring(sourcePrefix.length)
      const targetBlobName = `${targetPrefix}${relativePath}`
      const targetBlobClient = containerClient.getBlobClient(targetBlobName)

      if (operation === 'copy') {
        // Copy the blob
        await targetBlobClient.beginCopyFromURL(sourceBlobClient.url)
      } else if (operation === 'move') {
        // Copy the blob to the new location
        await targetBlobClient.beginCopyFromURL(sourceBlobClient.url)
        // Delete the original blob after successful copy
        await sourceBlobClient.delete()
      }
    }

    // Create folder placeholder in the target location
    await createEmptyFolder(targetPath)

    // If it was a move, remove the source folder placeholder
    if (operation === 'move') {
      const sourcePlaceholderPath = `${sourcePrefix}.folder`
      const placeholderBlobClient = containerClient.getBlobClient(
        sourcePlaceholderPath
      )
      if (await placeholderBlobClient.exists()) {
        await placeholderBlobClient.delete()
      }
    }

    return targetPath
  } catch (error) {
    console.error(`Error during folder ${operation} operation:`, error)
    return null
  }
}

/**
 * Lists all files and subfolders in a folder
 */
export async function listFolderContents(
  folderPath: string
): Promise<string[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  // Add trailing slash if not present
  const prefix = folderPath
    ? folderPath.endsWith('/')
      ? folderPath
      : `${folderPath}/`
    : ''

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  const blobs: string[] = []

  // List all blobs with the folder prefix
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    // Skip the folder placeholder itself
    if (!blob.name.endsWith('/.folder')) {
      blobs.push(blob.name)
    }
  }

  return blobs
}

/**
 * Rename a file or folder
 */
export async function renameItem(
  oldPath: string,
  newName: string,
  isFolder: boolean
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    if (isFolder) {
      // For folders, we need to move all contents to the new path
      // 1. Determine the parent path and create a new path with the new name
      const pathParts = oldPath.split('/')
      const parentPath =
        pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''

      const newPath = parentPath ? `${parentPath}/${newName}` : newName

      // Use the existing moveOrCopyFolder function
      return await moveOrCopyFolder(oldPath, newPath, 'move')
    } else {
      // For files, we'll copy the blob to the new path and delete the old one

      // Get file extension if exists
      const fileName = oldPath.split('/').pop() ?? ''
      const extension = fileName.includes('.')
        ? fileName.substring(fileName.lastIndexOf('.'))
        : ''

      const pathParts = oldPath.split('/')
      const parentPath =
        pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : ''

      // Preserve the file extension if it exists
      const newFileName = extension ? `${newName}${extension}` : newName

      const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName

      // Get source blob and create destination blob
      const sourceBlobClient = containerClient.getBlobClient(oldPath)
      const destBlobClient = containerClient.getBlobClient(newPath)

      // Verify source exists
      if (!(await sourceBlobClient.exists())) {
        console.error(`Source blob ${oldPath} does not exist`)
        return null
      }

      // Copy the blob's properties and metadata
      const sourceProperties = await sourceBlobClient.getProperties()

      // Copy the blob
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
        return newPath
      } else {
        console.error('Copy operation failed:', copyResult.copyStatus)
        return null
      }
    }
  } catch (error) {
    console.error(`Error during rename operation:`, error)
    return null
  }
}
