/**
 * Fetches a PDF document from the API
 */
export async function fetchPdf(fileName: string): Promise<Uint8Array> {
  // First get the SAS URL through our API
  const response = await fetch(
    `/api/documents/download?name=${encodeURIComponent(fileName)}`
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error ?? 'Failed to fetch PDF URL')
  }

  const { url } = await response.json()

  // Use a server proxy to fetch the PDF to avoid CORS issues
  const proxyResponse = await fetch(
    `/api/documents/proxy?url=${encodeURIComponent(url)}`
  )

  if (!proxyResponse.ok) {
    throw new Error('Failed to fetch PDF from proxy')
  }

  const arrayBuffer = await proxyResponse.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Fetches version information for a document
 */
export async function fetchVersionInfo(baseName: string): Promise<{
  totalVersions: number
  currentVersion?: number
  versions: Array<{
    fileName: string
    versionNumber: number
  }>
}> {
  const response = await fetch(
    `/api/documents/versions?baseName=${encodeURIComponent(baseName)}`
  )

  if (!response.ok) {
    throw new Error('Failed to fetch version information')
  }

  return response.json()
}
