// src/lib/folder-manager.ts
import { TableClient } from '@azure/data-tables'
import { BlobServiceClient } from '@azure/storage-blob'

export interface Folder {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
  parentId: string | null
}

export interface FolderItem {
  id: string
  name: string
  type: 'folder' | 'file'
  path: string
  size?: string
  lastModified?: string
}

// Get a TableClient instance for the folders table
function getTableClient() {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'folders'
    )
  }

  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'folders'
  )
}

// Initialize the folders table if it doesn't exist
export async function initFoldersTable() {
  const tableClient = getTableClient()
  try {
    await tableClient.createTable()
  } catch (error: any) {
    if (error.statusCode === 409) {
      return // Table already exists
    }
    console.error('Error creating folders table:', error)
  }
}

// Create a new folder
export async function createFolder(
  name: string,
  parentPath: string = ''
): Promise<Folder | null> {
  const tableClient = getTableClient()

  try {
    // Format the folder path
    const path = parentPath ? `${parentPath}/${name}` : name

    // Check if folder already exists
    const existingFolder = await getFolderByPath(path)
    if (existingFolder) {
      return existingFolder
    }

    // Generate ID and timestamps
    const id = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const timestamp = new Date().toISOString()

    // Get parent folder ID
    let parentId = null
    if (parentPath) {
      const parentFolder = await getFolderByPath(parentPath)
      parentId = parentFolder?.id ?? null
    }

    // Create folder entity
    const folderEntity = {
      partitionKey: 'folders',
      rowKey: id,
      id,
      name,
      path,
      createdAt: timestamp,
      updatedAt: timestamp,
      parentId: parentId ?? ''
    }

    await tableClient.createEntity(folderEntity)

    return {
      id,
      name,
      path,
      createdAt: timestamp,
      updatedAt: timestamp,
      parentId
    }
  } catch (error) {
    console.error('Error creating folder:', error)
    return null
  }
}

// Get a folder by its path
export async function getFolderByPath(path: string): Promise<Folder | null> {
  const tableClient = getTableClient()

  try {
    // Query for folder with the given path
    const iterator = tableClient.listEntities({
      queryOptions: {
        filter: `path eq '${path}'`
      }
    })

    for await (const folder of iterator) {
      return {
        id: folder.id as string,
        name: folder.name as string,
        path: folder.path as string,
        createdAt: folder.createdAt as string,
        updatedAt: folder.updatedAt as string,
        parentId: folder.parentId ? (folder.parentId as string) : null
      }
    }

    return null
  } catch (error) {
    console.error('Error getting folder by path:', error)
    return null
  }
}

// Get a folder by its ID
export async function getFolderById(id: string): Promise<Folder | null> {
  const tableClient = getTableClient()

  try {
    const entity = await tableClient.getEntity('folders', id)

    return {
      id: entity.id as string,
      name: entity.name as string,
      path: entity.path as string,
      createdAt: entity.createdAt as string,
      updatedAt: entity.updatedAt as string,
      parentId: entity.parentId ? (entity.parentId as string) : null
    }
  } catch (error: any) {
    if (error.statusCode === 404) {
      return null
    }
    console.error('Error getting folder by ID:', error)
    return null
  }
}

// Get all subfolders for a given parent path
export async function getSubfolders(
  parentPath: string = ''
): Promise<Folder[]> {
  const tableClient = getTableClient()
  const folders: Folder[] = []

  try {
    let queryOptions = {}

    if (parentPath) {
      // Get folders with the exact parent ID
      const parentFolder = await getFolderByPath(parentPath)
      if (parentFolder) {
        queryOptions = {
          filter: `parentId eq '${parentFolder.id}'`
        }
      } else {
        return [] // Parent folder doesn't exist
      }
    } else {
      // Get root folders (those with no parent)
      queryOptions = {
        filter: `parentId eq ''`
      }
    }

    const iterator = tableClient.listEntities({ queryOptions })

    for await (const folder of iterator) {
      folders.push({
        id: folder.id as string,
        name: folder.name as string,
        path: folder.path as string,
        createdAt: folder.createdAt as string,
        updatedAt: folder.updatedAt as string,
        parentId: folder.parentId ? (folder.parentId as string) : null
      })
    }

    return folders
  } catch (error) {
    console.error('Error getting subfolders:', error)
    return []
  }
}

// List the contents of a folder (both subfolders and files)
export async function listFolderContents(
  folderPath: string = ''
): Promise<FolderItem[]> {
  const contents: FolderItem[] = []

  try {
    // Get subfolders
    const subfolders = await getSubfolders(folderPath)

    // Add folders to results
    for (const folder of subfolders) {
      contents.push({
        id: folder.id,
        name: folder.name,
        type: 'folder',
        path: folder.path
      })
    }

    // Get blob files in this folder
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Prepare the prefix for listing blobs
    const prefix = folderPath ? `${folderPath}/` : ''

    // Only list blobs directly in this folder (not in subfolders)
    const iterator = containerClient.listBlobsFlat({
      prefix
    })

    // Process each blob
    for await (const blob of iterator) {
      // Skip if this is not directly in the current folder
      const blobPath = blob.name

      // Skip folders (they're already handled above)
      if (blobPath.endsWith('/')) continue

      // Get relative path inside the current folder
      const relativePath = folderPath
        ? blobPath.substring(prefix.length)
        : blobPath

      // Skip files in subfolders
      if (relativePath.includes('/')) continue

      // Get file metadata
      const blobClient = containerClient.getBlobClient(blobPath)
      const properties = await blobClient.getProperties()

      // Format size
      const sizeBytes = blob.properties.contentLength ?? 0
      const size = formatBytes(sizeBytes)

      contents.push({
        id: blobPath,
        name: relativePath,
        type: 'file',
        path: blobPath,
        size,
        lastModified: properties.lastModified?.toISOString()
      })
    }

    return contents
  } catch (error) {
    console.error('Error listing folder contents:', error)
    return []
  }
}

// Rename a folder
export async function renameFolder(
  folderId: string,
  newName: string
): Promise<Folder | null> {
  const tableClient = getTableClient()

  try {
    // Get the folder
    const folder = await getFolderById(folderId)
    if (!folder) {
      return null
    }

    // Get parent path
    const parentPath = folder.path.split('/').slice(0, -1).join('/')

    // Create new path
    const newPath = parentPath ? `${parentPath}/${newName}` : newName

    // Check if a folder with the new path already exists
    const existingFolder = await getFolderByPath(newPath)
    if (existingFolder) {
      throw new Error('A folder with this name already exists')
    }

    // Update folder in table
    await tableClient.updateEntity(
      {
        partitionKey: 'folders',
        rowKey: folderId,
        name: newName,
        path: newPath,
        updatedAt: new Date().toISOString()
      },
      'Merge'
    )

    // Get the storage container client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // List all blobs with the old folder path prefix
    const oldPrefix = `${folder.path}/`
    const iterator = containerClient.listBlobsFlat({
      prefix: oldPrefix
    })

    // Update each blob's path
    for await (const blob of iterator) {
      const oldPath = blob.name
      const newBlobPath = oldPath.replace(oldPrefix, `${newPath}/`)

      // Copy to new path
      const sourceClient = containerClient.getBlobClient(oldPath)
      const targetClient = containerClient.getBlobClient(newBlobPath)

      await targetClient.beginCopyFromURL(sourceClient.url)
      await sourceClient.delete()
    }

    // Update any subfolders' paths in the database
    const updateSubfolderPaths = async (
      oldBasePath: string,
      newBasePath: string
    ) => {
      const iterator = tableClient.listEntities({
        queryOptions: {
          filter: `path gt '${oldBasePath}/' and path lt '${oldBasePath}0'`
        }
      })

      for await (const subfolder of iterator) {
        const subfolderPath = subfolder.path as string
        const relativePath = subfolderPath.substring(oldBasePath.length)
        const newSubfolderPath = `${newBasePath}${relativePath}`

        await tableClient.updateEntity(
          {
            partitionKey: 'folders',
            rowKey: subfolder.rowKey as string,
            path: newSubfolderPath,
            updatedAt: new Date().toISOString()
          },
          'Merge'
        )
      }
    }

    await updateSubfolderPaths(folder.path, newPath)

    // Return updated folder
    return {
      ...folder,
      name: newName,
      path: newPath,
      updatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error renaming folder:', error)
    return null
  }
}

// Delete a folder and all its contents
export async function deleteFolder(folderId: string): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    // Get the folder
    const folder = await getFolderById(folderId)
    if (!folder) {
      return false
    }

    // Get the storage container client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Delete all blobs in the folder
    const prefix = `${folder.path}/`
    const iterator = containerClient.listBlobsFlat({
      prefix
    })

    for await (const blob of iterator) {
      await containerClient.deleteBlob(blob.name)
    }

    // Get all subfolders recursively
    const getAllSubfolderIds = async (folderId: string): Promise<string[]> => {
      const subfolderIds: string[] = []
      const iterator = tableClient.listEntities({
        queryOptions: {
          filter: `parentId eq '${folderId}'`
        }
      })

      for await (const subfolder of iterator) {
        const subFolderId = subfolder.id as string
        subfolderIds.push(subFolderId)
        const childIds = await getAllSubfolderIds(subFolderId)
        subfolderIds.push(...childIds)
      }

      return subfolderIds
    }

    const subfolderIds = await getAllSubfolderIds(folderId)

    // Delete all subfolders
    for (const subFolderId of subfolderIds) {
      await tableClient.deleteEntity('folders', subFolderId)
    }

    // Delete the folder itself
    await tableClient.deleteEntity('folders', folderId)

    return true
  } catch (error) {
    console.error('Error deleting folder:', error)
    return false
  }
}

// Move or copy a folder
export async function moveOrCopyFolder(
  folderId: string,
  targetFolderPath: string,
  operation: 'move' | 'copy' = 'move'
): Promise<Folder | null> {
  const tableClient = getTableClient()

  try {
    // Get the folder to move
    const folder = await getFolderById(folderId)
    if (!folder) {
      return null
    }

    // Get or create the target folder
    let targetFolder: Folder | null = null
    if (targetFolderPath) {
      targetFolder = await getFolderByPath(targetFolderPath)
      if (!targetFolder) {
        return null
      }
    }

    // Compute new path
    const newPath = targetFolderPath
      ? `${targetFolderPath}/${folder.name}`
      : folder.name

    // Check if a folder with the same name already exists at the destination
    const existingFolder = await getFolderByPath(newPath)
    if (existingFolder) {
      throw new Error(
        'A folder with this name already exists at the destination'
      )
    }

    // Get the storage container client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Create a new folder entry in the database
    const newFolderId =
      operation === 'copy'
        ? `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        : folder.id

    const timestamp = new Date().toISOString()

    if (operation === 'copy') {
      // Create a new folder entity
      await tableClient.createEntity({
        partitionKey: 'folders',
        rowKey: newFolderId,
        id: newFolderId,
        name: folder.name,
        path: newPath,
        createdAt: timestamp,
        updatedAt: timestamp,
        parentId: targetFolder?.id ?? ''
      })
    } else {
      // Update the existing folder
      await tableClient.updateEntity(
        {
          partitionKey: 'folders',
          rowKey: folderId,
          path: newPath,
          updatedAt: timestamp,
          parentId: targetFolder?.id ?? ''
        },
        'Merge'
      )
    }

    // List all files in the folder
    const oldPrefix = `${folder.path}/`
    const iterator = containerClient.listBlobsFlat({
      prefix: oldPrefix
    })

    // Process each blob (file)
    for await (const blob of iterator) {
      const oldPath = blob.name
      const relativePath = oldPath.substring(oldPrefix.length)
      const newBlobPath = `${newPath}/${relativePath}`

      // Copy to new location
      const sourceClient = containerClient.getBlobClient(oldPath)
      const targetClient = containerClient.getBlobClient(newBlobPath)

      await targetClient.beginCopyFromURL(sourceClient.url)

      // Delete original if moving
      if (operation === 'move') {
        await sourceClient.delete()
      }
    }

    // Handle subfolders recursively
    const processSubfolders = async (
      _sourceFolderId: string,
      sourceBasePath: string,
      targetBasePath: string,
      newParentId: string
    ) => {
      const subfolders = await getSubfolders(sourceBasePath)

      for (const subfolder of subfolders) {
        const relativePathPart = subfolder.path.substring(
          sourceBasePath.length + 1
        )
        const newSubfolderPath = `${targetBasePath}/${relativePathPart}`
        const newSubfolderId =
          operation === 'copy'
            ? `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
            : subfolder.id

        if (operation === 'copy') {
          // Create a copy of the subfolder
          await tableClient.createEntity({
            partitionKey: 'folders',
            rowKey: newSubfolderId,
            id: newSubfolderId,
            name: subfolder.name,
            path: newSubfolderPath,
            createdAt: timestamp,
            updatedAt: timestamp,
            parentId: newParentId
          })
        } else {
          // Update the existing subfolder
          await tableClient.updateEntity(
            {
              partitionKey: 'folders',
              rowKey: subfolder.id,
              path: newSubfolderPath,
              updatedAt: timestamp,
              parentId: newParentId
            },
            'Merge'
          )
        }

        // Process this subfolder's contents recursively
        await processSubfolders(
          subfolder.id,
          subfolder.path,
          newSubfolderPath,
          newSubfolderId
        )
      }
    }

    await processSubfolders(folder.id, folder.path, newPath, newFolderId)

    // Return the folder with its new path
    return {
      id: newFolderId,
      name: folder.name,
      path: newPath,
      createdAt: operation === 'copy' ? timestamp : folder.createdAt,
      updatedAt: timestamp,
      parentId: targetFolder?.id ?? null
    }
  } catch (error) {
    console.error(
      `Error ${operation === 'move' ? 'moving' : 'copying'} folder:`,
      error
    )
    return null
  }
}

// Move or copy a file
export async function moveOrCopyFile(
  filePath: string,
  targetFolderPath: string,
  operation: 'move' | 'copy' = 'move',
  newName?: string
): Promise<string | null> {
  try {
    // Get the storage container client
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Extract file name from path
    const fileName = filePath.split('/').pop() ?? ''

    // Determine new file path
    const newFileName = newName ?? fileName
    const newFilePath = targetFolderPath
      ? `${targetFolderPath}/${newFileName}`
      : newFileName

    // Check if the file already exists at the destination
    const targetClient = containerClient.getBlobClient(newFilePath)
    const exists = await targetClient.exists()

    if (exists) {
      throw new Error('A file with this name already exists at the destination')
    }

    // Copy the file to the new location
    const sourceClient = containerClient.getBlobClient(filePath)
    await targetClient.beginCopyFromURL(sourceClient.url)

    // Delete the original if moving
    if (operation === 'move') {
      await sourceClient.delete()
    }

    return newFilePath
  } catch (error) {
    console.error(
      `Error ${operation === 'move' ? 'moving' : 'copying'} file:`,
      error
    )
    return null
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
