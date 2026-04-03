import { Readable } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createShortUrl,
  generateShortCode,
  resolveShortUrl
} from '../url-shortener'

// --- pure function tests (no mocks needed) ---

describe('generateShortCode', () => {
  it('returns a string of the default length (7)', () => {
    expect(generateShortCode()).toHaveLength(7)
  })

  it('returns a string of a custom length', () => {
    expect(generateShortCode(12)).toHaveLength(12)
  })

  it('only contains alphanumeric characters', () => {
    const code = generateShortCode(100)
    expect(code).toMatch(/^[A-Za-z0-9]+$/u)
  })

  it('produces different codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

// --- Azure-dependent tests ---

const { mockBlobClient, mockBlockBlobClient, mockContainerClient } = vi.hoisted(
  () => {
    const mockBlockBlobClient = { upload: vi.fn() }
    const mockBlobClient = {
      exists: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      download: vi.fn()
    }
    const mockContainerClient = {
      getBlobClient: vi.fn(() => mockBlobClient),
      getBlockBlobClient: vi.fn(() => mockBlockBlobClient),
      exists: vi.fn(),
      create: vi.fn().mockResolvedValue({})
    }
    return { mockBlobClient, mockBlockBlobClient, mockContainerClient }
  }
)

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => mockContainerClient)
    }))
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true'
  mockContainerClient.exists.mockResolvedValue(true)
  mockBlockBlobClient.upload.mockResolvedValue({})
})

describe('createShortUrl', () => {
  it('uploads a JSON blob and returns the short code', async () => {
    const shortCode = await createShortUrl('https://example.com/very/long/url')

    expect(shortCode).toHaveLength(7)
    expect(mockBlockBlobClient.upload).toHaveBeenCalledOnce()

    const uploadedContent = JSON.parse(
      mockBlockBlobClient.upload.mock.calls[0][0]
    )
    expect(uploadedContent.originalUrl).toBe(
      'https://example.com/very/long/url'
    )
    expect(uploadedContent.shortCode).toBe(shortCode)
  })

  it('creates the container when it does not exist', async () => {
    mockContainerClient.exists.mockResolvedValue(false)

    await createShortUrl('https://example.com')

    expect(mockContainerClient.create).toHaveBeenCalledOnce()
  })

  it('throws when the upload fails', async () => {
    mockBlockBlobClient.upload.mockRejectedValue(new Error('upload failed'))
    await expect(createShortUrl('https://example.com')).rejects.toThrow(
      'Failed to create short URL'
    )
  })
})

describe('resolveShortUrl', () => {
  function makeStream(data: object) {
    return Readable.from([Buffer.from(JSON.stringify(data))])
  }

  it('returns the original URL for a valid, non-expired short code', async () => {
    mockBlobClient.exists.mockResolvedValue(true)
    mockBlobClient.download.mockResolvedValue({
      readableStreamBody: makeStream({
        shortCode: 'abc1234',
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString()
      })
    })

    const url = await resolveShortUrl('abc1234')
    expect(url).toBe('https://example.com')
  })

  it('returns null when the blob does not exist', async () => {
    mockBlobClient.exists.mockResolvedValue(false)
    expect(await resolveShortUrl('missing')).toBeNull()
  })

  it('returns null and deletes the blob when the URL is expired', async () => {
    mockBlobClient.exists.mockResolvedValue(true)
    mockBlobClient.download.mockResolvedValue({
      readableStreamBody: makeStream({
        shortCode: 'abc1234',
        originalUrl: 'https://example.com',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdAt: new Date().toISOString()
      })
    })

    const url = await resolveShortUrl('abc1234')
    expect(url).toBeNull()
    expect(mockBlobClient.delete).toHaveBeenCalledOnce()
  })
})
