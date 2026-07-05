import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getVersionHistory } from '../admin/templates/[id]/version-history/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn()
}))
vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetById
}))

const { mockGetTemplateVersionHistory } = vi.hoisted(() => ({
  mockGetTemplateVersionHistory: vi.fn()
}))
vi.mock('@/lib/template-version-history', () => ({
  getTemplateVersionHistory: mockGetTemplateVersionHistory
}))

const { mockGetUserById } = vi.hoisted(() => ({
  mockGetUserById: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getUserById: mockGetUserById
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { id: 'user_1', roles: ['Customer User'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist v2',
  description: 'Annual review',
  blobPath: null,
  formSchema: null,
  questions: null,
  version: 2,
  tenantId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-02-01T00:00:00.000Z'
}

const HISTORY_ENTRY = {
  id: 'history_1',
  templateId: 'template_123',
  version: 1,
  changeReason: 'New COSHH regulation April 2026',
  snapshot: {
    title: 'Farmyard Safety Checklist',
    description: 'Annual review',
    formSchema: null,
    questions: null
  },
  publishedAt: '2024-01-15T00:00:00.000Z',
  publishedBy: 'admin_1'
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetById.mockResolvedValue(BASE_TEMPLATE)
  mockGetTemplateVersionHistory.mockResolvedValue([])
  mockGetUserById.mockResolvedValue(null)
})

describe('GET /api/admin/templates/[id]/version-history', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123/version-history'
    )
    const res = await getVersionHistory(req, params('template_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when template does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/missing/version-history'
    )
    const res = await getVersionHistory(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns just the current version when there is no history', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetTemplateVersionHistory.mockResolvedValue([])

    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123/version-history'
    )
    const res = await getVersionHistory(req, params('template_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0]).toMatchObject({
      version: 2,
      isCurrent: true,
      changeReason: null,
      publishedBy: null,
      publishedByName: null,
      publishedAt: BASE_TEMPLATE.updatedAt
    })
  })

  it('combines current + history, resolving author names, sorted desc by version', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetTemplateVersionHistory.mockResolvedValue([HISTORY_ENTRY])
    mockGetUserById.mockResolvedValue({
      id: 'admin_1',
      displayName: 'Simon Admin'
    })

    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123/version-history'
    )
    const res = await getVersionHistory(req, params('template_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toHaveLength(2)
    expect(body.entries[0]).toMatchObject({ version: 2, isCurrent: true })
    expect(body.entries[1]).toMatchObject({
      version: 1,
      isCurrent: false,
      changeReason: 'New COSHH regulation April 2026',
      publishedBy: 'admin_1',
      publishedByName: 'Simon Admin'
    })
  })

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetTemplateVersionHistory.mockRejectedValue(new Error('db error'))

    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123/version-history'
    )
    const res = await getVersionHistory(req, params('template_123'))
    expect(res.status).toBe(500)
  })
})
