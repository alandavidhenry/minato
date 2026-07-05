import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as publishVersion } from '../customer/admin/templates/[id]/publish-version/route'
import {
  DELETE as deleteTemplate,
  GET as getTemplate,
  PATCH as updateTemplate
} from '../customer/admin/templates/[id]/route'
import {
  GET as listTemplates,
  POST as createTemplate
} from '../customer/admin/templates/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetByOwnerCompany,
  mockCreate,
  mockGetById,
  mockUpdate,
  mockDelete,
  mockPublishNewVersion
} = vi.hoisted(() => ({
  mockGetByOwnerCompany: vi.fn(),
  mockCreate: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockPublishNewVersion: vi.fn()
}))

vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplatesByOwnerCompany: mockGetByOwnerCompany,
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

const COMPANY_ADMIN_SESSION = {
  user: {
    id: 'ca_1',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_123'
  }
}
const OTHER_COMPANY_ADMIN_SESSION = {
  user: {
    id: 'ca_2',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_456'
  }
}
const NO_COMPANY_SESSION = {
  user: { id: 'ca_3', roles: ['Customer Admin'], customerCompanyId: null }
}
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Site Induction Checklist',
  description: 'Internal induction form',
  blobPath: null,
  formSchema: null,
  questions: null,
  version: 1,
  tenantId: null,
  ownerCompanyId: 'company_123',
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
  mockGetByOwnerCompany.mockResolvedValue([])
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
// GET /api/customer/admin/templates
// ---------------------------------------------------------------------------

describe('GET /api/customer/admin/templates', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non Customer Admin roles', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('returns 403 when the user has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('returns 200 with templates scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetByOwnerCompany.mockResolvedValue([BASE_TEMPLATE])
    const res = await listTemplates()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.templates).toHaveLength(1)
    expect(mockGetByOwnerCompany).toHaveBeenCalledWith('company_123')
  })
})

// ---------------------------------------------------------------------------
// POST /api/customer/admin/templates
// ---------------------------------------------------------------------------

describe('POST /api/customer/admin/templates', () => {
  it('returns 403 when not Customer Admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates',
      'POST',
      { title: 'Checklist' }
    )
    const res = await createTemplate(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when title is missing', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates',
      'POST',
      {}
    )
    const res = await createTemplate(req)
    expect(res.status).toBe(400)
  })

  it('creates the template scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates',
      'POST',
      { title: 'Site Induction Checklist' }
    )
    const res = await createTemplate(req)
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerCompanyId: 'company_123' })
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('GET /api/customer/admin/templates/[id]', () => {
  it('returns 404 when not found', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/missing'
    )
    const res = await getTemplate(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(OTHER_COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123'
    )
    const res = await getTemplate(req, params('template_123'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with the template when owned by the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123'
    )
    const res = await getTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).template.title).toBe('Site Induction Checklist')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/customer/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/customer/admin/templates/[id]', () => {
  it('returns 404 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(OTHER_COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates/template_123',
      'PATCH',
      { title: 'Updated' }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates/template_123',
      'PATCH',
      { title: 'Updated' }
    )
    const res = await updateTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('template_123', {
      title: 'Updated'
    })
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/customer/admin/templates/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/customer/admin/templates/[id]', () => {
  it('returns 404 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(OTHER_COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('template_123'))
    expect(res.status).toBe(404)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns 409 when template has assignments', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockDelete.mockResolvedValue(false)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('template_123'))
    expect(res.status).toBe(409)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123',
      { method: 'DELETE' }
    )
    const res = await deleteTemplate(req, params('template_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /api/customer/admin/templates/[id]/publish-version
// ---------------------------------------------------------------------------

describe('POST /api/customer/admin/templates/[id]/publish-version', () => {
  it('returns 403 when not Customer Admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/admin/templates/template_123/publish-version',
      { method: 'POST' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(OTHER_COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: 'Updated site rules' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(404)
    expect(mockPublishNewVersion).not.toHaveBeenCalled()
  })

  it('returns 400 when changeReason is missing', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/templates/template_123/publish-version',
      'POST',
      {}
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(400)
    expect(mockPublishNewVersion).not.toHaveBeenCalled()
  })

  it('returns 200 with new version and assignments created', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_TEMPLATE)
    mockPublishNewVersion.mockResolvedValue({ ...BASE_TEMPLATE, version: 2 })
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
      'http://localhost/api/customer/admin/templates/template_123/publish-version',
      'POST',
      { changeReason: 'Updated site rules' }
    )
    const res = await publishVersion(req, params('template_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.newVersion).toBe(2)
    expect(body.assignmentsCreated).toBe(1)
    expect(mockPublishNewVersion).toHaveBeenCalledWith(
      'template_123',
      expect.objectContaining({
        changeReason: 'Updated site rules',
        publishedBy: 'ca_1'
      })
    )
  })
})
