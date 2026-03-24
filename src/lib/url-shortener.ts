import { randomBytes } from 'crypto'

import { BlobServiceClient } from '@azure/storage-blob'

interface ShortenedUrl {
  shortCode: string
  originalUrl: string
  expiresAt: Date
  createdAt: Date
}

const CODE_LENGTH = 7
const URL_CONTAINER = 'url-shortener'

export function generateShortCode(length: number = CODE_LENGTH): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  const result: string[] = []

  // Use rejection sampling to avoid modulo bias when mapping random bytes
  // into the character set indices.
  const maxUnbiased = Math.floor(256 / charactersLength) * charactersLength

  while (result.length < length) {
    const bytes = randomBytes(length - result.length)
    for (const byte of bytes) {
      if (byte >= maxUnbiased) {
        continue
      }
      const index = byte % charactersLength
      result.push(characters[index])
      if (result.length === length) {
        break
      }
    }
  }

  return result.join('')
}

export async function createShortUrl(
  originalUrl: string,
  expirationDays: number = 7
): Promise<string> {
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
    const containerClient = blobServiceClient.getContainerClient(URL_CONTAINER)

    if (!(await containerClient.exists())) {
      await containerClient.create({ access: 'blob' })
    }

    const shortenedUrl: ShortenedUrl = {
      shortCode,
      originalUrl,
      expiresAt: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    }

    const content = JSON.stringify(shortenedUrl)
    const blobClient = containerClient.getBlockBlobClient(shortCode)
    await blobClient.upload(content, content.length)

    return shortCode
  } catch (error) {
    console.error('Error creating short URL:', error)
    throw new Error(
      `Failed to create short URL: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

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
    const blobClient = containerClient.getBlobClient(shortCode)

    if (!(await blobClient.exists())) {
      return null
    }

    const downloadResponse = await blobClient.download(0)
    const content = await streamToString(downloadResponse.readableStreamBody!)
    const urlMapping = JSON.parse(content) as ShortenedUrl

    if (new Date(urlMapping.expiresAt) < new Date()) {
      await blobClient.delete()
      return null
    }

    return urlMapping.originalUrl
  } catch (error) {
    console.error('Error resolving short URL:', error)
    return null
  }
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}
