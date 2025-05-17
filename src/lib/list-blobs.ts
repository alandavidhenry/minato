// src/lib/list-blobs.ts

import { getFileManager } from './file-system'
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

export async function listBlobs(
  includeVersions: boolean = false,
  path: string = ''
): Promise<BlobItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    // Use our file manager to list contents
    const fileManager = getFileManager()
    const contents = await fileManager.listContent(path)

    // Process contents to match our original BlobItem interface
    const items: BlobItem[] = contents.map((item) => ({
      id: item.isFolder ? `folder:${item.fullPath}` : item.fullPath,
      name: item.name,
      path: item.fullPath,
      uploadedAt: item.uploadedAt ?? '-',
      type: item.isFolder ? 'folder' : (item.type ?? getContentType(item.name)),
      size: item.size ?? '-',
      hasVersions: false,
      isFolder: item.isFolder
    }))

    // If we need to include versions, we need to add version information
    if (includeVersions) {
      // Group documents by version
      const documentsWithVersions = await groupDocumentsByVersion(
        containerName,
        connectionString,
        path
      )

      // Convert to BlobItems and merge with our folder list
      const folders = items.filter((item) => item.isFolder)

      const documents = documentsWithVersions.flatMap((doc) =>
        doc.versions.map((version) => ({
          id: version.fileName,
          name: version.fileName,
          path: getFolderPath(version.fileName),
          uploadedAt: version.uploadedAt.toLocaleDateString(),
          type: getContentType(version.fileName),
          size: version.size,
          hasVersions: doc.versions.length > 1,
          versionNumber: version.versionNumber,
          totalVersions: doc.versions.length,
          originalName: version.originalName,
          isFolder: false
        }))
      )

      return [...folders, ...documents]
    } else {
      // If we're not including all versions, just return the latest version of each
      const folders = items.filter((item) => item.isFolder)

      // Group documents by version and get latest version info
      const documentsWithVersions = await groupDocumentsByVersion(
        containerName,
        connectionString,
        path
      )

      // Convert to BlobItems with version information
      const filesWithVersionInfo = documentsWithVersions.map((doc) => ({
        id: doc.latestVersion.fileName,
        name: doc.latestVersion.fileName,
        path: getFolderPath(doc.latestVersion.fileName),
        uploadedAt: doc.latestVersion.uploadedAt.toLocaleDateString(),
        type: getContentType(doc.latestVersion.fileName),
        size: doc.latestVersion.size,
        hasVersions: doc.versions.length > 1,
        versionNumber:
          doc.versions.length > 0 ? doc.latestVersion.versionNumber : 1,
        totalVersions: doc.versions.length,
        originalName: doc.originalName,
        isFolder: false
      }))

      // Merge our folder list with files that have version info
      return [...folders, ...filesWithVersionInfo]
    }
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
