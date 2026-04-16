import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as downloadCompletion } from '../admin/completions/[id]/download/route'
import { GET as listCompletions } from '../admin/completions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAll, mockGetById } = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockGetById: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  getAllCompletionsForAdmin: mockGetAll,
  getCompletionById: mockGetById
}))

const { mockGenerateSasToken } = vi.hoisted(() => ({
  mockGenerateSasToken: vi.fn()
}))
vi.mock('@/lib/storage', () => ({
  generateSasToken: mockGenerateSasToken
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_COMPLETION_FOR_ADMIN = {
  id: 'record_123',
  signedAt: '2024-01-01T00:00:00.000Z',
  blobPath: 'completions/record_123.pdf',
  signer: {
    id: 'user_123',
    displayName: 'Jane Smith',
    email: 'jane@example.com'
  },
  assignment: {
    id: 'assignment_123',
    template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
    customerCompany: { id: 'company_123', name: 'Acme Farm' }
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockGetById.mockResolvedValue(null)
  mockGenerateSasToken.mockResolvedValue('https://blob.example.com/sas-url')
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listCompletions()
    expect(res.status).toBe(200)
    expect((await res.json()).completions).toHaveLength(0)
  })

  it('returns 200 with completions including signer and company', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAll.mockResolvedValue([BASE_COMPLETION_FOR_ADMIN])
    const res = await listCompletions()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].signer.displayName).toBe('Jane Smith')
    expect(body.completions[0].assignment.customerCompany.name).toBe(
      'Acme Farm'
    )
    expect(body.completions[0].assignment.template.title).toBe(
      'Farmyard Safety Checklist'
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions/[id]/download', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when completion not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/missing/download'
    )
    const res = await downloadCompletion(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion has no PDF', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue({
      ...BASE_COMPLETION_FOR_ADMIN,
      blobPath: null
    })
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/pdf not available/i)
  })

  it('returns 200 with download URL', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPLETION_FOR_ADMIN)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.example.com/sas-url')
  })
})
