// src/lib/list-blobs.ts
import { BlobServiceClient } from '@azure/storage-blob'

import { groupDocumentsByVersion } from './version-manager'

export interface BlobItem {
  id: string
  name: string
  uploadedAt: string
  type: string
  size: string
  hasVersions: boolean
  versionNumber?: number
  totalVersions?: number
  originalName?: string
  isFolder?: boolean
  path?: string
}

interface DocumentVersion {
  fileName: string
  uploadedAt: Date
  size: string
  versionNumber: number
  originalName: string
}

interface VersionedDocument {
  versions: DocumentVersion[]
  latestVersion: DocumentVersion
  originalName: string
}

export async function listBlobs(
  includeVersions: boolean = false,
  path: string = ''
): Promise<BlobItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    // Group documents by version
    const documentsWithVersions = await groupDocumentsByVersion(
      containerName,
      connectionString,
      path
    )

    // Get folders from virtual folder structure (files in folders)
    const folders = extractFolders(documentsWithVersions, path)

    // Also find empty folders (folders with no files)
    const emptyFolders = await findEmptyFolders(
      containerName,
      connectionString,
      path
    )

    // Combine folder lists and remove duplicates
    const allFolders = [...folders]
    for (const emptyFolder of emptyFolders) {
      if (!allFolders.some((f) => f.path === emptyFolder.path)) {
        allFolders.push(emptyFolder)
      }
    }

    // Generate the document list based on whether we want to include all versions
    let documents: BlobItem[]
    if (includeVersions) {
      // Return all versions of all documents
      documents = documentsWithVersions.flatMap((doc) =>
        doc.versions.map((version) => ({
          id: version.fileName,
          name: version.fileName,
          uploadedAt: version.uploadedAt.toLocaleDateString(),
          type: getContentType(version.fileName),
          size: version.size,
          hasVersions: doc.versions.length > 1,
          versionNumber: version.versionNumber,
          totalVersions: doc.versions.length,
          originalName: version.originalName,
          isFolder: false,
          path: getFolderPath(version.fileName)
        }))
      )
    } else {
      // Return only the latest version of each document
      documents = documentsWithVersions.map((doc) => ({
        id: doc.latestVersion.fileName,
        name: doc.latestVersion.fileName,
        uploadedAt: doc.latestVersion.uploadedAt.toLocaleDateString(),
        type: getContentType(doc.latestVersion.fileName),
        size: doc.latestVersion.size,
        hasVersions: doc.versions.length > 1,
        versionNumber:
          doc.versions.length > 0 ? doc.latestVersion.versionNumber : 1,
        totalVersions: doc.versions.length,
        originalName: doc.originalName,
        isFolder: false,
        path: getFolderPath(doc.latestVersion.fileName)
      }))
    }

    // Combine the documents and folders
    return [...allFolders, ...documents]
  } catch (error) {
    console.error('Error listing blobs:', error)
    throw error
  }
}

/**
 * Get document versions for a specific base name
 */
export async function getDocumentVersions(
  baseName: string
): Promise<BlobItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    // Import dynamically to avoid circular dependencies
    const { getDocumentVersions } = await import('./version-manager')

    // Get all versions of this document
    const versions = await getDocumentVersions(
      baseName,
      containerName,
      connectionString
    )

    // Convert to BlobItem format
    return versions.map((version) => ({
      id: version.fileName,
      name: version.fileName,
      uploadedAt: version.uploadedAt.toLocaleDateString(),
      type: getContentType(version.fileName),
      size: version.size,
      hasVersions: versions.length > 1,
      versionNumber: version.versionNumber,
      totalVersions: versions.length,
      originalName: version.originalName,
      path: getFolderPath(version.fileName)
    }))
  } catch (error) {
    console.error('Error getting document versions:', error)
    throw error
  }
}

/**
 * Extract direct subfolders from the current path
 */
function extractFolders(
  documentsWithVersions: VersionedDocument[],
  currentPath: string = ''
): BlobItem[] {
  // Store unique folder paths that are direct children of the current path
  const folderSet = new Set<string>()

  // Determine the depth of the current path
  const currentPathDepth = currentPath ? currentPath.split('/').length : 0

  // Process all document versions to find folders
  for (const doc of documentsWithVersions) {
    for (const version of doc.versions) {
      const fileName = version.fileName

      // Skip files that don't contain slashes (not in folders)
      if (fileName.indexOf('/') === -1) continue

      // Skip .folder placeholder files
      if (fileName.endsWith('/.folder')) continue

      // Split the file path
      const pathParts = fileName.split('/')

      // If this file is in a deeper subfolder of the current path
      if (pathParts.length > currentPathDepth + 1) {
        // Get the direct subfolder
        const subfolderPath = currentPath
          ? `${currentPath}/${pathParts[currentPathDepth]}`
          : pathParts[0]

        folderSet.add(subfolderPath)
      }
    }
  }

  const folders = Array.from(folderSet).map((folderPath) => {
    const folderName = folderPath.split('/').pop() ?? folderPath

    return {
      id: `folder:${folderPath}`,
      name: folderName,
      uploadedAt: '-',
      type: 'folder',
      size: '-',
      hasVersions: false,
      isFolder: true,
      path: folderPath
    }
  })

  return folders
}

/**
 * Find empty folders by looking for .folder placeholder files
 */
async function findEmptyFolders(
  containerName: string,
  connectionString: string,
  currentPath: string
): Promise<BlobItem[]> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  // Determine the prefix for listing blobs
  const prefix = currentPath ? `${currentPath}/` : ''

  const folderItems: BlobItem[] = []

  // List blobs with the folder prefix
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    const fileName = blob.name

    // Look for .folder placeholder files
    if (fileName.endsWith('/.folder')) {
      // Extract folder path from the placeholder
      const folderPath = fileName.substring(0, fileName.lastIndexOf('/.folder'))

      // Only include folders that are direct children of the current path
      if (isDirectChild(folderPath, currentPath)) {
        const folderName = folderPath.split('/').pop() ?? folderPath

        folderItems.push({
          id: `folder:${folderPath}`,
          name: folderName,
          uploadedAt: '-',
          type: 'folder',
          size: '-',
          hasVersions: false,
          isFolder: true,
          path: folderPath
        })
      }
    }
  }

  return folderItems
}

/**
 * Check if a path is a direct child of the current path
 */
function isDirectChild(path: string, currentPath: string): boolean {
  if (!currentPath) {
    // If current path is root, check if the path has no slashes
    return path.indexOf('/') === -1
  }

  // Split both paths
  const currentParts = currentPath.split('/')
  const pathParts = path.split('/')

  // A direct child has exactly one more segment than the current path
  return (
    pathParts.length === currentParts.length + 1 &&
    path.startsWith(currentPath + '/')
  )
}

/**
 * Get the folder path from a file name
 * Example: "documents/2023/report.pdf" -> "documents/2023"
 */
function getFolderPath(fileName: string): string {
  const lastSlashIndex = fileName.lastIndexOf('/')
  if (lastSlashIndex > 0) {
    return fileName.substring(0, lastSlashIndex)
  }
  return ''
}

/**
 * Determine content type based on file extension
 */
function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml'
  }

  return mimeTypes[extension] || 'application/octet-stream'
}
