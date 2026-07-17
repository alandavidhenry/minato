// src/lib/document-upload.ts
// Shared upload path for P19 upload-based documents: stores a PDF as-is, or
// converts a Word document to PDF (via document-conversion.ts) and retains
// the original alongside it. Used by both the admin and customer-admin
// template upload routes, and later by completion (fill-and-return) uploads.
import {
  convertToPdf,
  isConvertibleToPdf,
  isPdfMimeType
} from './document-conversion'
import { uploadBlob } from './storage'

export interface UploadedSourceDocument {
  blobPath: string
  originalBlobPath: string | null
  fileName: string
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim()
}

export async function uploadSourceDocument({
  buffer,
  fileName,
  mimeType,
  pathPrefix
}: {
  buffer: Buffer
  fileName: string
  mimeType: string
  pathPrefix: string
}): Promise<UploadedSourceDocument> {
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
  const blobPath = `${pathPrefix}/source.pdf`

  if (isPdfMimeType(mimeType)) {
    await uploadBlob(containerName, blobPath, buffer, 'application/pdf')
    return { blobPath, originalBlobPath: null, fileName }
  }

  if (isConvertibleToPdf(mimeType)) {
    const convertedBuffer = await convertToPdf(buffer, fileName)
    const originalBlobPath = `${pathPrefix}/source-original-${sanitizeFilename(fileName)}`
    await Promise.all([
      uploadBlob(containerName, blobPath, convertedBuffer, 'application/pdf'),
      uploadBlob(containerName, originalBlobPath, buffer, mimeType)
    ])
    return { blobPath, originalBlobPath, fileName }
  }

  throw new Error(`Unsupported file type: ${mimeType}`)
}
