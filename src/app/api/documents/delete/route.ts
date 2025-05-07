// src/app/api/documents/delete/route.ts
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

interface DeleteRequestBody {
  items?: Array<{
    name: string
    isFolder?: boolean
    path?: string
  }>
  names?: string[]
}

interface DeleteResult {
  name: string
  path?: string
  isFolder: boolean
  success: boolean
  deletedCount?: number
  message: string
}

// Helper function to check if a name is likely a folder
function looksLikeFolder(name: string): boolean {
  // Clean the name - remove any trailing slash or space
  const cleanName = name.trim().replace(/\/+$/, '')

  // If it's empty after cleaning, it's not a valid name
  if (!cleanName) return false

  return (
    !cleanName.includes('.') || // No file extension
    cleanName.toLowerCase().includes('folder') // Contains 'folder' in the name
  )
}

// Helper function to delete a single file (not folder)
async function deleteSingleFile(
  containerClient: ContainerClient,
  fileName: string
): Promise<boolean> {
  try {
    const blobClient = containerClient.getBlobClient(fileName)
    await blobClient.delete()
    return true
  } catch (error) {
    console.error(`Error deleting file ${fileName}:`, error)
    return false
  }
}

// Helper function to delete folder contents
async function deleteFolderContents(
  containerClient: ContainerClient,
  folderPath: string
): Promise<{ success: boolean; count: number }> {
  try {
    let deletedCount = 0
    // Ensure the folder path has the right format for prefix matching
    const normalizedPath = folderPath.endsWith('/')
      ? folderPath
      : `${folderPath}/`

    console.log(`Deleting folder contents with prefix: "${normalizedPath}"`)

    // Find and delete all blobs with the folder prefix
    const blobsToDelete = []
    for await (const blob of containerClient.listBlobsFlat({
      prefix: normalizedPath
    })) {
      blobsToDelete.push(blob.name)
    }

    console.log(`Found ${blobsToDelete.length} blobs to delete in folder`)

    // Delete each blob
    for (const blobName of blobsToDelete) {
      try {
        const blobClient = containerClient.getBlobClient(blobName)
        await blobClient.delete()
        deletedCount++
        console.log(`Deleted blob: ${blobName}`)
      } catch (blobError) {
        console.error(`Failed to delete blob ${blobName}:`, blobError)
      }
    }

    // Try to delete the folder placeholder if it exists
    try {
      const placeholderPath = `${normalizedPath}.folder`
      const placeholderClient = containerClient.getBlobClient(placeholderPath)

      if (await placeholderClient.exists()) {
        await placeholderClient.delete()
        deletedCount++
        console.log(`Deleted folder placeholder: ${placeholderPath}`)
      }
    } catch {
      console.log('Placeholder not found or not deleted (non-critical)')
    }

    return { success: deletedCount > 0, count: deletedCount }
  } catch (error) {
    console.error(`Error deleting folder ${folderPath}:`, error)
    return { success: false, count: 0 }
  }
}

// Main DELETE handler
export async function DELETE(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get container client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Parse request
    const requestBody = (await request
      .json()
      .catch(() => ({}) as DeleteRequestBody)) as DeleteRequestBody

    // Handle items deletion (files or folders)
    if (requestBody.items && Array.isArray(requestBody.items)) {
      console.log('Processing items deletion request')
      const results: DeleteResult[] = []

      for (const item of requestBody.items) {
        if (item.isFolder) {
          // For folders, use the path if available, otherwise name
          const folderPath = item.path ?? item.name
          console.log(`Processing folder deletion: ${folderPath}`)

          const result = await deleteFolderContents(containerClient, folderPath)
          results.push({
            name: item.name,
            path: folderPath,
            isFolder: true,
            success: result.success,
            deletedCount: result.count,
            message: result.success
              ? `Deleted folder with ${result.count} item(s)`
              : 'Failed to delete folder or folder was empty'
          })
        } else {
          // For files, just delete the single blob
          console.log(`Processing file deletion: ${item.name}`)
          const success = await deleteSingleFile(containerClient, item.name)
          results.push({
            name: item.name,
            isFolder: false,
            success,
            message: success ? 'File deleted' : 'Failed to delete file'
          })
        }
      }

      return NextResponse.json({ results })
    }

    if (requestBody.names && Array.isArray(requestBody.names)) {
      console.log(
        'Processing legacy names deletion request:',
        requestBody.names
      )
      const results = []

      for (const name of requestBody.names) {
        // Check if the name contains a path separator
        if (name.includes('/')) {
          // For paths with '/', extract the last segment to determine if it's a file or folder
          const lastSegment = name.split('/').pop() ?? ''
          const isLikelyFolder = looksLikeFolder(lastSegment)

          if (isLikelyFolder) {
            console.log(
              `Path "${name}" with last segment "${lastSegment}" looks like a folder, treating as folder deletion`
            )
            const result = await deleteFolderContents(containerClient, name)
            results.push({
              name,
              path: name,
              isFolder: true,
              success: result.success,
              deletedCount: result.count,
              message: result.success
                ? `Deleted folder with ${result.count} item(s)`
                : 'Failed to delete folder or folder was empty'
            })
          } else {
            // This is a file inside a folder
            console.log(
              `Path "${name}" with last segment "${lastSegment}" looks like a file in a folder`
            )
            const success = await deleteSingleFile(containerClient, name)
            results.push({
              name,
              isFolder: false,
              success,
              message: success ? 'File deleted' : 'Failed to delete file'
            })
          }
        } else {
          // For simple names without '/', use the original logic
          const isLikelyFolder = looksLikeFolder(name)
          if (isLikelyFolder) {
            console.log(
              `Name "${name}" looks like a folder, treating as folder deletion`
            )
            const result = await deleteFolderContents(containerClient, name)
            results.push({
              name,
              path: name,
              isFolder: true,
              success: result.success,
              deletedCount: result.count,
              message: result.success
                ? `Deleted folder with ${result.count} item(s)`
                : 'Failed to delete folder or folder was empty'
            })
          } else {
            console.log(`Treating "${name}" as a regular file`)
            const success = await deleteSingleFile(containerClient, name)
            results.push({
              name,
              isFolder: false,
              success,
              message: success ? 'File deleted' : 'Failed to delete file'
            })
          }
        }
      }

      return NextResponse.json({ results })
    }

    // Single file deletion via query parameter
    const name = request.nextUrl.searchParams.get('name')
    if (name) {
      // Check if it looks like a folder
      const isLikelyFolder = looksLikeFolder(name)

      if (isLikelyFolder) {
        console.log(
          `Query param "${name}" looks like a folder, treating as folder deletion`
        )
        const result = await deleteFolderContents(containerClient, name)
        return NextResponse.json({
          name,
          isFolder: true,
          success: result.success,
          deletedCount: result.count,
          message: result.success
            ? `Deleted folder with ${result.count} item(s)`
            : 'Failed to delete folder or folder was empty'
        })
      } else {
        console.log(`Processing single file deletion: ${name}`)
        const success = await deleteSingleFile(containerClient, name)
        return NextResponse.json({
          name,
          isFolder: false,
          success,
          message: success ? 'File deleted' : 'Failed to delete file'
        })
      }
    }

    return NextResponse.json(
      { error: 'Invalid request, no items to delete specified' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Delete operation failed'
      },
      { status: 500 }
    )
  }
}
