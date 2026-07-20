import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../health/deep/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { $queryRaw: vi.fn() }
}))
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const { mockContainerClient } = vi.hoisted(() => ({
  mockContainerClient: { getProperties: vi.fn() }
}))
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => mockContainerClient)
    }))
  }
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health/deep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    mockContainerClient.getProperties.mockResolvedValue({})
  })

  it('returns status ok with 200 when all checks pass', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      checks: { db: 'ok', storage: 'ok' }
    })
  })

  it('returns status degraded with 503 when db check fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      status: 'degraded',
      checks: { db: 'error', storage: 'ok' }
    })
  })

  it('returns status degraded with 503 when storage check fails', async () => {
    mockContainerClient.getProperties.mockRejectedValue(
      new Error('storage down')
    )
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      status: 'degraded',
      checks: { db: 'ok', storage: 'error' }
    })
  })

  it('returns status degraded with 503 when all checks fail', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'))
    mockContainerClient.getProperties.mockRejectedValue(
      new Error('storage down')
    )
    const res = await GET()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      status: 'degraded',
      checks: { db: 'error', storage: 'error' }
    })
  })
})
