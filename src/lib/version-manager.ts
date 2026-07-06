import { BlobServiceClient } from '@azure/storage-blob'

import { formatSize } from './file-system/format-utils'

export interface DocumentVersion {
  id: string // Unique version ID (using timestamp)
  fileName: string // Full filename in storage including version info
  originalName: string // Original filename without version info
  uploadedAt: Date // When this version was uploaded
  size: string // File size (formatted)
  sizeBytes: number // File size in bytes (for sorting)
  versionNumber: number // Sequential version number
}

export interface DocumentWithVersions {
  documentId: string // Base document ID (based on original filename)
  originalName: string // Original filename
  latestVersion: DocumentVersion
  versions: DocumentVersion[]
}

export function generateVersionId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export function parseFileName(fileName: string): {
  baseName: string
  versionId: string | null
  extension: string
} {
  const fileNameWithoutPath = fileName.split('/').pop() ?? fileName

  const extension =
    fileNameWithoutPath.lastIndexOf('.') > 0
      ? fileNameWithoutPath.substring(fileNameWithoutPath.lastIndexOf('.'))
      : ''

  const nameWithoutExtension = extension
    ? fileNameWithoutPath.substring(0, fileNameWithoutPath.lastIndexOf('.'))
    : fileNameWithoutPath

  const vIndex = nameWithoutExtension.lastIndexOf('_v_')

  if (vIndex !== -1) {
    const folderPath = fileName.includes('/')
      ? fileName.substring(0, fileName.lastIndexOf('/') + 1)
      : ''

    return {
      baseName: folderPath + nameWithoutExtension.substring(0, vIndex),
      versionId: nameWithoutExtension.substring(vIndex + 3),
      extension
    }
  }

  const folderPath = fileName.includes('/')
    ? fileName.substring(0, fileName.lastIndexOf('/') + 1)
    : ''

  return {
    baseName: folderPath + nameWithoutExtension,
    versionId: null,
    extension
  }
}

export function createVersionedFileName(
  originalName: string,
  versionId: string
): string {
  const { baseName, extension } = parseFileName(originalName)
  const lastSlashIndex = baseName.lastIndexOf('/')

  if (lastSlashIndex >= 0) {
    const path = baseName.substring(0, lastSlashIndex + 1)
    const nameOnly = baseName.substring(lastSlashIndex + 1)
    return `${path}${nameOnly}_v_${versionId}${extension}`
  }

  return `${baseName}_v_${versionId}${extension}`
}

export async function groupDocumentsByVersion(
  containerName: string,
  connectionString: string,
  folderPath: string = ''
): Promise<DocumentWithVersions[]> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  const versionMap = new Map<string, DocumentVersion[]>()

  const prefix = folderPath ? `${folderPath}/` : ''

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    const fileName = blob.name

    if (fileName.endsWith('/.folder')) {
      continue
    }

    if (isFileInCurrentFolder(fileName, folderPath)) {
      const { baseName, versionId } = parseFileName(fileName)

      const fileNameWithoutPath = fileName.split('/').pop() ?? fileName
      const originalName = `${fileNameWithoutPath.replace(/_v_[^.]+(?=\.)/, '')}`
      const documentId = baseName

      const sizeBytes = blob.properties.contentLength ?? 0

      const version: DocumentVersion = {
        id: versionId ?? 'original',
        fileName,
        originalName,
        uploadedAt: blob.properties.lastModified ?? new Date(),
        size: formatSize(sizeBytes),
        sizeBytes,
        versionNumber: 1
      }

      if (!versionMap.has(documentId)) {
        versionMap.set(documentId, [])
      }
      versionMap.get(documentId)!.push(version)
    }
  }

  const documentsWithVersions: DocumentWithVersions[] = []

  for (const [documentId, versions] of versionMap.entries()) {
    const sortedVersions = versions.toSorted(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    )

    sortedVersions.forEach((version, index) => {
      version.versionNumber = sortedVersions.length - index
    })

    documentsWithVersions.push({
      documentId,
      originalName: sortedVersions[0].originalName,
      latestVersion: sortedVersions[0],
      versions: sortedVersions
    })
  }

  return documentsWithVersions
}

export async function getDocumentVersions(
  baseName: string,
  containerName: string,
  connectionString: string
): Promise<DocumentVersion[]> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  const versions: DocumentVersion[] = []

  for await (const blob of containerClient.listBlobsFlat()) {
    const fileName = blob.name
    const { baseName: currentBaseName } = parseFileName(fileName)

    if (currentBaseName === baseName) {
      const { versionId, extension } = parseFileName(fileName)

      const fileNameWithoutPath = fileName.split('/').pop() ?? fileName
      const originalName =
        fileNameWithoutPath.replace(/_v_[^.]+(?=\.)/, '') + extension

      const sizeBytes = blob.properties.contentLength ?? 0

      versions.push({
        id: versionId ?? 'original',
        fileName,
        originalName,
        uploadedAt: blob.properties.lastModified ?? new Date(),
        size: formatSize(sizeBytes),
        sizeBytes,
        versionNumber: 1
      })
    }
  }

  const sortedVersions = versions.toSorted(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
  )

  sortedVersions.forEach((version, index) => {
    version.versionNumber = sortedVersions.length - index
  })

  return sortedVersions
}

function isFileInCurrentFolder(fileName: string, folderPath: string): boolean {
  if (!folderPath) {
    return fileName.split('/').length === 1
  }

  const folderParts = folderPath.split('/')
  const fileParts = fileName.split('/')

  if (fileParts.length !== folderParts.length + 1) {
    return false
  }

  return fileParts.slice(0, folderParts.length).join('/') === folderPath
}
