import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DELETE as deleteTemplate,
  GET as getTemplate,
  PATCH as updateTemplate
} from '../admin/templates/[id]/route'
import {
  GET as listTemplates,
  POST as createTemplate
} from '../admin/templates/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAll, mockCreate, mockGetById, mockUpdate, mockDelete } =
  vi.hoisted(() => ({
    mockGetAll: vi.fn(),
    mockCreate: vi.fn(),
    mockGetById: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn()
  }))

vi.mock('@/lib/document-templates', () => ({
  getAllDocumentTemplates: mockGetAll,
  createDocumentTemplate: mockCreate,
  getDocumentTemplateById: mockGetById,
  updateDocumentTemplate: mockUpdate,
  deleteDocumentTemplate: mockDelete
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: 'Annual review',
  blobPath: null,
  formSchema: null,
  tenantId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockCreate.mockResolvedValue(BASE_TEMPLATE)
  mockGetById.mockResolvedValue(null)
  mockUpdate.mockResolvedValue(true)
  mockDelete.mockResolvedValue(true)
})

// ---------------------------------------------------------------------------
// GET /api/admin/templates
// ---------------------------------------------------------------------------

describe('GET /api/admin/templates', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('returns 200 with templates', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAll.mockResolvedValue([BASE_TEMPLATE])
    const res = await listTemplates()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.templates).toHaveLength(1)
    expect(body.templates[0].title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/templates
// ---------------------------------------------------------------------------

describe('POST /api/admin/templates', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/admin/templates', 'POST', {
      title: 'Checklist'
    })
    const res = await createTemplate(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when title is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/templates', 'POST', {})
    const res = await createTemplate(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/title/i)
  })

  it('returns 200 with new template', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/templates', 'POST', {
      title: 'Farmyard Safety Checklist'
    })
    const res = await createTemplate(req)
    expect(res.status).toBe(200)
    expect((await res.json()).template.title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('GET /api/admin/templates/[id]', () => {
  it('returns 404 when not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest('http://localhost/api/admin/templates/missing')
    const res = await getTemplate(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with template', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123'
    )
    const res = await getTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).template.title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/templates/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123',
      'PATCH',
      { title: 'Updated' }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123',
      'PATCH',
      { title: 'Updated' }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('returns 200 when saving a formSchema', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const schema = [
      {
        id: 'q1',
        label: 'Are fire exits clear?',
        type: 'checkbox',
        required: true
      }
    ]
    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123',
      'PATCH',
      { formSchema: schema }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('template_123', {
      formSchema: schema
    })
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/templates/[id]', () => {
  it('returns 404 when template does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/missing',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when template has assignments', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockDelete.mockResolvedValue(false)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('template_123'))
    expect(res.status).toBe(409)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})
