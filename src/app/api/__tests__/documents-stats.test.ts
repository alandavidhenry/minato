import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../documents/stats/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockListBlobsFlat, mockContainerClient } = vi.hoisted(() => {
  const mockListBlobsFlat = vi.fn()
  const mockContainerClient = { listBlobsFlat: mockListBlobsFlat }
  return { mockListBlobsFlat, mockContainerClient }
})
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => mockContainerClient)
    }))
  }
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function* blobsOf(names: string[]) {
  for (const name of names) {
    yield { name }
  }
}

const AUTH_SESSION = {
  user: {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    roles: ['Admin']
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true'
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'documents'
})

describe('GET /api/documents/stats', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    mockListBlobsFlat.mockReturnValue(blobsOf([]))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('counts unique documents, excluding .folder markers and deduplicating versions', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockListBlobsFlat.mockReturnValue(
      blobsOf([
        // doc1: 4 versions
        'doc1_v_2024-01-01T00-00-00-000Z.pdf',
        'doc1_v_2024-01-02T00-00-00-000Z.pdf',
        'doc1_v_2024-01-03T00-00-00-000Z.pdf',
        'doc1.pdf',
        // doc2: 2 versions in a folder
        'folder-a/.folder',
        'folder-a/doc2_v_2024-01-01T00-00-00-000Z.pdf',
        'folder-a/doc2.pdf',
        // doc3: 1 version
        'folder-b/.folder',
        'folder-b/doc3.pdf',
        '.folder'
      ])
    )

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.totalDocuments).toBe(3)
  })

  it('returns 0 when container has only folder markers', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockListBlobsFlat.mockReturnValue(
      blobsOf(['.folder', 'a/.folder', 'a/b/.folder'])
    )

    const res = await GET()
    const body = await res.json()

    expect(body.totalDocuments).toBe(0)
  })

  it('returns 500 on storage error', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockListBlobsFlat.mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
