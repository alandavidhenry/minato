// src/lib/url-shortener.ts
import { BlobServiceClient } from '@azure/storage-blob'

interface ShortenedUrl {
  shortCode: string
  originalUrl: string
  expiresAt: Date
  createdAt: Date
}

// Short code length
const CODE_LENGTH = 7

// The container where we'll store shortened URL mappings
const URL_CONTAINER = 'url-shortener'

/**
 * Generates a random alphanumeric string of specified length
 */
export function generateShortCode(length: number = CODE_LENGTH): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const charactersLength = characters.length

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}

/**
 * Creates a short URL and stores mapping in Azure Blob Storage
 */
export async function createShortUrl(
  originalUrl: string,
  expirationDays: number = 7
): Promise<string> {
  // Generate a short code
  const shortCode = generateShortCode()

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error(
        'Missing AZURE_STORAGE_CONNECTION_STRING environment variable'
      )
    }

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)

    // Ensure container exists
    const containerClient = blobServiceClient.getContainerClient(URL_CONTAINER)
    const containerExists = await containerClient.exists()

    if (!containerExists) {
      // Create container with "blob" access level
      // Valid options are "container" or "blob" - not "private"
      await containerClient.create({ access: 'blob' })
    }

    // Create URL mapping object
    const shortenedUrl: ShortenedUrl = {
      shortCode,
      originalUrl,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    }

    // Store in blob storage
    const blobClient = containerClient.getBlockBlobClient(shortCode)
    await blobClient.upload(
      JSON.stringify(shortenedUrl),
      JSON.stringify(shortenedUrl).length
    )

    return shortCode
  } catch (error) {
    console.error('Error creating short URL:', error)
    throw new Error(
      `Failed to create short URL: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Resolves a short code to the original URL
 */
export async function resolveShortUrl(
  shortCode: string
): Promise<string | null> {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error(
        'Missing AZURE_STORAGE_CONNECTION_STRING environment variable'
      )
    }

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(URL_CONTAINER)

    // Get the mapping from blob storage
    const blobClient = containerClient.getBlobClient(shortCode)
    const exists = await blobClient.exists()

    if (!exists) {
      return null
    }

    const downloadResponse = await blobClient.download(0)
    const content = await streamToString(downloadResponse.readableStreamBody!)
    const urlMapping = JSON.parse(content) as ShortenedUrl

    // Check if URL has expired
    if (new Date(urlMapping.expiresAt) < new Date()) {
      // Optional: Clean up expired URLs
      await blobClient.delete()
      return null
    }

    return urlMapping.originalUrl
  } catch (error) {
    console.error('Error resolving short URL:', error)
    return null
  }
}

/**
 * Helper to convert stream to string
 */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}
