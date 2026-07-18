import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getTemplateDocument } from '../admin/templates/[id]/document/route'

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

const { mockGenerateSasToken } = vi.hoisted(() => ({
  mockGenerateSasToken: vi.fn()
}))
vi.mock('@/lib/storage', () => ({
  generateSasToken: mockGenerateSasToken
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const FORM_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: null,
  blobPath: null,
  formSchema: null,
  sourceType: 'form',
  sourceDocBlobPath: null,
  sourceDocFileName: null
}

const UPLOAD_TEMPLATE = {
  ...FORM_TEMPLATE,
  sourceType: 'upload',
  sourceDocBlobPath: 'templates/template_123/source.pdf',
  sourceDocFileName: 'H&S Policy.docx'
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function req(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/templates/${id}/document`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetById.mockResolvedValue(null)
  mockGenerateSasToken.mockResolvedValue(null)
})

describe('GET /api/admin/templates/[id]/document', () => {
  it('returns 403 when not an admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await getTemplateDocument(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when template not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const res = await getTemplateDocument(req('missing'), params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 for a form-based template (no source document)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(FORM_TEMPLATE)
    const res = await getTemplateDocument(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(404)
  })

  it('returns 200 with a view URL for an upload-based template', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(UPLOAD_TEMPLATE)
    mockGenerateSasToken.mockResolvedValue(
      'https://blob.example.com/source-sas-url'
    )
    const res = await getTemplateDocument(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe(
      'https://blob.example.com/source-sas-url'
    )
    const [, blobPath, options] = mockGenerateSasToken.mock.calls[0]
    expect(blobPath).toBe('templates/template_123/source.pdf')
    expect(options).toMatchObject({ permissions: 'r' })
  })

  it('returns 500 when SAS token generation fails', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(UPLOAD_TEMPLATE)
    mockGenerateSasToken.mockRejectedValue(new Error('boom'))
    const res = await getTemplateDocument(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(500)
  })
})
