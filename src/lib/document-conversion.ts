// src/lib/document-conversion.ts
// Converts uploaded Word documents to PDF via a Gotenberg sidecar
// (https://gotenberg.dev), so uploaded H&S documents are stored and served
// as a tamper-evident PDF while the original Word file is retained
// separately for future editing/renewal.

const GOTENBERG_CONVERT_PATH = '/forms/libreoffice/convert'

const CONVERTIBLE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

export function isConvertibleToPdf(mimeType: string): boolean {
  return CONVERTIBLE_MIME_TYPES.has(mimeType)
}

export async function convertToPdf(
  buffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const gotenbergUrl = process.env.GOTENBERG_URL
  if (!gotenbergUrl) {
    throw new Error(
      'GOTENBERG_URL is not configured; cannot convert document to PDF.'
    )
  }

  // Copy into a plain Uint8Array — Buffer's underlying ArrayBufferLike type
  // isn't directly assignable to the BlobPart type Blob's constructor expects.
  const bytes = new Uint8Array(buffer.byteLength)
  bytes.set(buffer)

  const formData = new FormData()
  formData.append('files', new Blob([bytes]), fileName)

  const authUsername = process.env.GOTENBERG_BASIC_AUTH_USERNAME
  const authPassword = process.env.GOTENBERG_BASIC_AUTH_PASSWORD
  const headers =
    authUsername && authPassword
      ? {
          Authorization: `Basic ${Buffer.from(`${authUsername}:${authPassword}`).toString('base64')}`
        }
      : undefined

  const response = await fetch(`${gotenbergUrl}${GOTENBERG_CONVERT_PATH}`, {
    method: 'POST',
    body: formData,
    ...(headers && { headers })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Document conversion failed (${response.status} ${response.statusText})` +
        (detail ? `: ${detail}` : '')
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
