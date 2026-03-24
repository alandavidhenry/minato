import { getFileManager } from './file-system'
import {
  groupDocumentsByVersion,
  getDocumentVersions as getVersionsFromStorage
} from './version-manager'

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
    const fileManager = getFileManager()
    const contents = await fileManager.listContent(path)

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

    const folders = items.filter((item) => item.isFolder)
    const documentsWithVersions = await groupDocumentsByVersion(
      containerName,
      connectionString,
      path
    )

    if (includeVersions) {
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
    }

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

    return [...folders, ...filesWithVersionInfo]
  } catch (error) {
    console.error('Error listing blobs:', error)
    throw error
  }
}

export async function getDocumentVersions(
  baseName: string
): Promise<BlobItem[]> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    const versions = await getVersionsFromStorage(
      baseName,
      containerName,
      connectionString
    )

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

function getFolderPath(fileName: string): string {
  const lastSlashIndex = fileName.lastIndexOf('/')
  return lastSlashIndex > 0 ? fileName.substring(0, lastSlashIndex) : ''
}

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
