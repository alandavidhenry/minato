// src/lib/version-manager.ts
import { BlobServiceClient } from '@azure/storage-blob'

interface DocumentVersion {
  id: string // Unique version ID (using timestamp)
  fileName: string // Full filename in storage including version info
  originalName: string // Original filename without version info
  uploadedAt: Date // When this version was uploaded
  size: string // File size (formatted)
  sizeBytes: number // File size in bytes (for sorting)
  versionNumber: number // Sequential version number
}

interface DocumentWithVersions {
  documentId: string // Base document ID (based on original filename)
  originalName: string // Original filename
  latestVersion: DocumentVersion
  versions: DocumentVersion[]
}

/**
 * Generates a version string for the document
 */
export function generateVersionId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * Extracts the base document name and version from a filename
 */
export function parseFileName(fileName: string): {
  baseName: string
  versionId: string | null
  extension: string
} {
  const extension =
    fileName.lastIndexOf('.') > 0
      ? fileName.substring(fileName.lastIndexOf('.'))
      : ''

  const nameWithoutExtension = extension
    ? fileName.substring(0, fileName.lastIndexOf('.'))
    : fileName

  // Check if the filename has a version (format: baseName_v_timestamp)
  const regex = /(.+)_v_(.+)$/
  const versionMatch = regex.exec(nameWithoutExtension)

  if (versionMatch) {
    return {
      baseName: versionMatch[1],
      versionId: versionMatch[2],
      extension
    }
  }

  return {
    baseName: nameWithoutExtension,
    versionId: null,
    extension
  }
}

/**
 * Creates a versioned filename
 */
export function createVersionedFileName(
  originalName: string,
  versionId: string
): string {
  const { baseName, extension } = parseFileName(originalName)
  return `${baseName}_v_${versionId}${extension}`
}

/**
 * Checks if a document is a version of another document
 */
export function areRelatedDocuments(
  fileName1: string,
  fileName2: string
): boolean {
  const { baseName: baseName1 } = parseFileName(fileName1)
  const { baseName: baseName2 } = parseFileName(fileName2)

  return baseName1 === baseName2
}

/**
 * Groups documents by their base name to create version groups
 */
export async function groupDocumentsByVersion(
  containerName: string,
  connectionString: string
): Promise<DocumentWithVersions[]> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  const versionMap = new Map<string, DocumentVersion[]>()

  // List all blobs
  for await (const blob of containerClient.listBlobsFlat()) {
    const fileName = blob.name
    const { baseName, versionId, extension } = parseFileName(fileName)
    const originalName = `${baseName}${extension}`
    const documentId = baseName

    // Get blob properties for metadata
    const properties = await containerClient
      .getBlobClient(fileName)
      .getProperties()

    // Format size
    const sizeBytes = blob.properties.contentLength ?? 0
    const size = formatBytes(sizeBytes)

    // Create version object
    const version: DocumentVersion = {
      id: versionId ?? 'original',
      fileName,
      originalName,
      uploadedAt: properties.lastModified ?? new Date(),
      size,
      sizeBytes,
      versionNumber: 1 // Will be calculated later
    }

    // Add to version map
    if (!versionMap.has(documentId)) {
      versionMap.set(documentId, [])
    }
    versionMap.get(documentId)!.push(version)
  }

  // Process each document group
  const documentsWithVersions: DocumentWithVersions[] = []

  for (const [documentId, versions] of versionMap.entries()) {
    // Sort versions by date (newest first)
    const sortedVersions = versions.toSorted(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    )

    // Assign version numbers (newest is highest number)
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

/**
 * Gets all versions of a specific document
 */
export async function getDocumentVersions(
  baseName: string,
  containerName: string,
  connectionString: string
): Promise<DocumentVersion[]> {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)

  const versions: DocumentVersion[] = []

  // List all blobs
  for await (const blob of containerClient.listBlobsFlat()) {
    const fileName = blob.name
    const { baseName: currentBaseName } = parseFileName(fileName)

    if (currentBaseName === baseName) {
      const { baseName, versionId, extension } = parseFileName(fileName)
      const originalName = `${baseName}${extension}`

      // Get blob properties for metadata
      const properties = await containerClient
        .getBlobClient(fileName)
        .getProperties()

      // Format size
      const sizeBytes = blob.properties.contentLength ?? 0
      const size = formatBytes(sizeBytes)

      // Create version object
      const version: DocumentVersion = {
        id: versionId ?? 'original',
        fileName,
        originalName,
        uploadedAt: properties.lastModified || new Date(),
        size,
        sizeBytes,
        versionNumber: 1 // Will be calculated later
      }

      versions.push(version)
    }
  }

  // Sort versions by date (newest first)
  const sortedVersions = versions.toSorted(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
  )

  // Assign version numbers (newest is highest number)
  sortedVersions.forEach((version, index) => {
    version.versionNumber = sortedVersions.length - index
  })

  return sortedVersions
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export type { DocumentVersion, DocumentWithVersions }
