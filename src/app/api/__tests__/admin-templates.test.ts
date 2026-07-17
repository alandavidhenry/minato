import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as publishVersion } from '../admin/templates/[id]/publish-version/route'
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

const {
  mockGetAll,
  mockCreate,
  mockGetById,
  mockUpdate,
  mockDelete,
  mockPublishNewVersion
} = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockCreate: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockPublishNewVersion: vi.fn()
}))

vi.mock('@/lib/document-templates', () => ({
  getAllDocumentTemplates: mockGetAll,
  createDocumentTemplate: mockCreate,
  getDocumentTemplateById: mockGetById,
  updateDocumentTemplate: mockUpdate,
  deleteDocumentTemplate: mockDelete,
  publishNewTemplateVersion: mockPublishNewVersion
}))

const { mockCreateAssignmentsForNewVersion } = vi.hoisted(() => ({
  mockCreateAssignmentsForNewVersion: vi.fn()
}))

vi.mock('@/lib/assignments', () => ({
  createAssignmentsForNewVersion: mockCreateAssignmentsForNewVersion
}))

const {
  mockGetUserById: mockGetUserByIdTemplates,
  mockGetUsersByCompany: mockGetUsersByCompanyTemplates,
  mockResolveEmailRecipients: mockResolveEmailRecipientsTemplates
} = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
  mockGetUsersByCompany: vi.fn(),
  mockResolveEmailRecipients: vi.fn()
}))

vi.mock('@/lib/user-database', () => ({
  getUserById: mockGetUserByIdTemplates,
  getUsersByCompany: mockGetUsersByCompanyTemplates,
  resolveEmailRecipients: mockResolveEmailRecipientsTemplates
}))

const { mockSendAssignmentNotificationTemplates } = vi.hoisted(() => ({
  mockSendAssignmentNotificationTemplates: vi.fn()
}))

vi.mock('@/lib/email', () => ({
  sendAssignmentNotification: mockSendAssignmentNotificationTemplates
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: 'Annual review',
  blobPath: null,
  formSchema: null,
  version: 1,
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
  mockPublishNewVersion.mockResolvedValue({ ...BASE_TEMPLATE, version: 2 })
  mockCreateAssignmentsForNewVersion.mockResolvedValue([])
  mockResolveEmailRecipientsTemplates.mockResolvedValue([])
  mockGetUsersByCompanyTemplates.mockResolvedValue([])
  mockSendAssignmentNotificationTemplates.mockResolvedValue(undefined)
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

  it('passes through upload-based template fields', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/templates', 'POST', {
      title: 'Fire Safety Policy',
      sourceType: 'upload',
      uploadMode: 'read-only',
      sourceDocBlobPath: 'template-uploads/v1/source.pdf',
      sourceDocOriginalBlobPath: 'template-uploads/v1/source-original.docx',
      sourceDocFileName: 'Fire Safety Policy.docx'
    })
    const res = await createTemplate(req)
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'upload',
        uploadMode: 'read-only',
        sourceDocBlobPath: 'template-uploads/v1/source.pdf',
        sourceDocOriginalBlobPath: 'template-uploads/v1/source-original.docx',
        sourceDocFileName: 'Fire Safety Policy.docx'
      })
    )
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

  it('returns 200 when saving comprehension questions', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const questions = [
      {
        id: 'cq1',
        question: 'What should you do in a fire?',
        answer: 'Evacuate immediately'
      }
    ]
    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123',
      'PATCH',
      { questions }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('template_123', { questions })
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

// ---------------------------------------------------------------------------
// POST /api/admin/templates/[id]/publish-version
// ---------------------------------------------------------------------------

describe('POST /api/admin/templates/[id]/publish-version', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      { method: 'POST' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when template does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/templates/missing/publish-version',
      { method: 'POST' }
    )
    const res = await publishVersion(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when changeReason is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      {}
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/reason/i)
    expect(mockPublishNewVersion).not.toHaveBeenCalled()
  })

  it('returns 400 when changeReason is blank', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: '   ' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with new version and assignments created', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const v2Template = { ...BASE_TEMPLATE, version: 2 }
    mockPublishNewVersion.mockResolvedValue(v2Template)
    mockCreateAssignmentsForNewVersion.mockResolvedValue([
      {
        id: 'a1',
        templateId: 'template_123',
        customerCompanyId: 'company_123',
        userId: null,
        dueDate: null,
        targetJobRoles: null,
        templateVersion: 2,
        createdAt: '2024-01-01T00:00:00.000Z'
      }
    ])

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: 'New COSHH regulation April 2026' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.newVersion).toBe(2)
    expect(body.previousVersion).toBe(1)
    expect(body.assignmentsCreated).toBe(1)
    expect(mockPublishNewVersion).toHaveBeenCalledWith(
      'template_123',
      expect.objectContaining({
        changeReason: 'New COSHH regulation April 2026',
        publishedBy: 'admin_1'
      })
    )
  })

  it('publishes with no existing assignments (assignmentsCreated = 0)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockPublishNewVersion.mockResolvedValue({ ...BASE_TEMPLATE, version: 2 })
    mockCreateAssignmentsForNewVersion.mockResolvedValue([])

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: 'New COSHH regulation April 2026' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignmentsCreated).toBe(0)
  })

  it('returns 500 when publishNewTemplateVersion fails', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockPublishNewVersion.mockResolvedValue(null)

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: 'New COSHH regulation April 2026' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(500)
  })

  it('passes through replacement source doc fields', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockPublishNewVersion.mockResolvedValue({ ...BASE_TEMPLATE, version: 2 })

    const req = jsonRequest(
      'http://localhost/api/admin/templates/template_123/publish-version',
      'POST',
      {
        changeReason: 'Updated fire safety procedure',
        sourceDocBlobPath: 'template-uploads/v2/source.pdf',
        sourceDocOriginalBlobPath: 'template-uploads/v2/source-original.docx',
        sourceDocFileName: 'Fire Safety Policy v2.docx'
      }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(200)
    expect(mockPublishNewVersion).toHaveBeenCalledWith(
      'template_123',
      expect.objectContaining({
        sourceDocBlobPath: 'template-uploads/v2/source.pdf',
        sourceDocOriginalBlobPath: 'template-uploads/v2/source-original.docx',
        sourceDocFileName: 'Fire Safety Policy v2.docx'
      })
    )
  })
})
