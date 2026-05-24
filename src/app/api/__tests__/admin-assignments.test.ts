import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE as removeAssignment } from '../admin/companies/[id]/assignments/[assignmentId]/route'
import {
  GET as listAssignments,
  POST as createAssignment
} from '../admin/companies/[id]/assignments/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetForCompany,
  mockCreate,
  mockGetByTemplateAndCompany,
  mockGetByTemplateAndUser,
  mockGetById,
  mockDelete
} = vi.hoisted(() => ({
  mockGetForCompany: vi.fn(),
  mockCreate: vi.fn(),
  mockGetByTemplateAndCompany: vi.fn(),
  mockGetByTemplateAndUser: vi.fn(),
  mockGetById: vi.fn(),
  mockDelete: vi.fn()
}))

vi.mock('@/lib/assignments', () => ({
  getAssignmentsForCompany: mockGetForCompany,
  createAssignment: mockCreate,
  getAssignmentByTemplateAndCompany: mockGetByTemplateAndCompany,
  getAssignmentByTemplateAndUser: mockGetByTemplateAndUser,
  getAssignmentById: mockGetById,
  deleteAssignment: mockDelete
}))

const { mockGetDocumentTemplateById } = vi.hoisted(() => ({
  mockGetDocumentTemplateById: vi.fn()
}))

vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetDocumentTemplateById
}))

const { mockGetUserById, mockGetUsersByCompany, mockResolveEmailRecipients } =
  vi.hoisted(() => ({
    mockGetUserById: vi.fn(),
    mockGetUsersByCompany: vi.fn(),
    mockResolveEmailRecipients: vi.fn()
  }))

vi.mock('@/lib/user-database', () => ({
  getUserById: mockGetUserById,
  getUsersByCompany: mockGetUsersByCompany,
  resolveEmailRecipients: mockResolveEmailRecipients
}))

const { mockSendAssignmentNotification } = vi.hoisted(() => ({
  mockSendAssignmentNotification: vi.fn()
}))

vi.mock('@/lib/email', () => ({
  sendAssignmentNotification: mockSendAssignmentNotification
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: null,
  blobPath: null,
  formSchema: null,
  questions: null,
  version: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}

const BASE_ASSIGNMENT = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  dueDate: null,
  targetJobRoles: null,
  templateVersion: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  template: {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: null,
    blobPath: null
  }
}

const USER_ASSIGNMENT = {
  ...BASE_ASSIGNMENT,
  id: 'assignment_456',
  userId: 'user_123'
}

const BASE_USER = {
  id: 'user_123',
  email: 'user@company.com',
  displayName: 'Test User',
  passwordHash: 'hash',
  role: 'Customer User',
  jobRole: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: 'company_123'
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function companyParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function assignmentParams(id: string, assignmentId: string) {
  return { params: Promise.resolve({ id, assignmentId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetForCompany.mockResolvedValue([])
  mockCreate.mockResolvedValue(BASE_ASSIGNMENT)
  mockGetByTemplateAndCompany.mockResolvedValue(null)
  mockGetByTemplateAndUser.mockResolvedValue(null)
  mockGetById.mockResolvedValue(null)
  mockDelete.mockResolvedValue(true)
  mockGetDocumentTemplateById.mockResolvedValue(BASE_TEMPLATE)
  mockGetUsersByCompany.mockResolvedValue([BASE_USER])
  mockGetUserById.mockResolvedValue(BASE_USER)
  mockSendAssignmentNotification.mockResolvedValue(undefined)
  // Default: pass email users through unchanged
  mockResolveEmailRecipients.mockImplementation((users: (typeof BASE_USER)[]) =>
    Promise.resolve(
      users
        .filter((u: typeof BASE_USER) => u.email)
        .map((u: typeof BASE_USER) => ({ email: u.email, name: u.displayName }))
    )
  )
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies/[id]/assignments
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies/[id]/assignments', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments'
    )
    const res = await listAssignments(req, companyParams('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with assignments', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetForCompany.mockResolvedValue([BASE_ASSIGNMENT])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments'
    )
    const res = await listAssignments(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(1)
    expect(body.assignments[0].template.title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/companies/[id]/assignments — company-wide
// ---------------------------------------------------------------------------

describe('POST /api/admin/companies/[id]/assignments (company-wide)', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when templateId is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      {}
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/templateId/i)
  })

  it('returns 400 when template does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetDocumentTemplateById.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_missing' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/template not found/i)
  })

  it('passes templateVersion from template to createAssignment', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetDocumentTemplateById.mockResolvedValue({
      ...BASE_TEMPLATE,
      version: 2
    })
    mockCreate.mockResolvedValue({ ...BASE_ASSIGNMENT, templateVersion: 2 })
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ templateVersion: 2 })
    )
  })

  it('returns 409 when already assigned to company', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetByTemplateAndCompany.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already assigned/i)
  })

  it('returns 200 with new company-wide assignment', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignment.templateId).toBe('template_123')
    expect(body.assignment.userId).toBeNull()
  })

  it('passes dueDate to createAssignment when provided', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const withDueDate = {
      ...BASE_ASSIGNMENT,
      dueDate: '2024-06-01T00:00:00.000Z'
    }
    mockCreate.mockResolvedValue(withDueDate)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', dueDate: '2024-06-01' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: '2024-06-01' })
    )
    expect((await res.json()).assignment.dueDate).toBe(
      '2024-06-01T00:00:00.000Z'
    )
  })

  it('passes targetJobRoles to createAssignment when provided', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const withRoles = {
      ...BASE_ASSIGNMENT,
      targetJobRoles: ['Site Manager', 'Supervisor']
    }
    mockCreate.mockResolvedValue(withRoles)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      {
        templateId: 'template_123',
        targetJobRoles: ['Site Manager', 'Supervisor']
      }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        targetJobRoles: ['Site Manager', 'Supervisor']
      })
    )
    expect((await res.json()).assignment.targetJobRoles).toEqual([
      'Site Manager',
      'Supervisor'
    ])
  })

  it('sends notifications to all company users on company-wide assignment', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const users = [
      { ...BASE_USER, id: 'u1', email: 'u1@co.com', displayName: 'User One' },
      { ...BASE_USER, id: 'u2', email: 'u2@co.com', displayName: 'User Two' }
    ]
    mockGetUsersByCompany.mockResolvedValue(users)

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        [
          { email: 'u1@co.com', name: 'User One' },
          { email: 'u2@co.com', name: 'User Two' }
        ],
        'Farmyard Safety Checklist',
        null,
        expect.any(String)
      )
    )
  })

  it('filters by job role when targetJobRoles is set', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const withRoles = { ...BASE_ASSIGNMENT, targetJobRoles: ['Site Manager'] }
    mockCreate.mockResolvedValue(withRoles)
    const users = [
      {
        ...BASE_USER,
        id: 'u1',
        email: 'mgr@co.com',
        displayName: 'Manager',
        jobRole: 'Site Manager'
      },
      {
        ...BASE_USER,
        id: 'u2',
        email: 'op@co.com',
        displayName: 'Operator',
        jobRole: 'Operator'
      }
    ]
    mockGetUsersByCompany.mockResolvedValue(users)

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', targetJobRoles: ['Site Manager'] }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        [{ email: 'mgr@co.com', name: 'Manager' }],
        'Farmyard Safety Checklist',
        null,
        expect.any(String)
      )
    )
  })

  it('includes users with no job role in filtered notifications', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const withRoles = { ...BASE_ASSIGNMENT, targetJobRoles: ['Site Manager'] }
    mockCreate.mockResolvedValue(withRoles)
    const users = [
      {
        ...BASE_USER,
        id: 'u1',
        email: 'mgr@co.com',
        displayName: 'Manager',
        jobRole: 'Site Manager'
      },
      {
        ...BASE_USER,
        id: 'u2',
        email: 'norole@co.com',
        displayName: 'No Role',
        jobRole: null
      }
    ]
    mockGetUsersByCompany.mockResolvedValue(users)

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', targetJobRoles: ['Site Manager'] }
    )
    await createAssignment(req, companyParams('company_123'))
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        expect.arrayContaining([
          { email: 'mgr@co.com', name: 'Manager' },
          { email: 'norole@co.com', name: 'No Role' }
        ]),
        expect.any(String),
        null,
        expect.any(String)
      )
    )
  })

  it('routes no-email users to their line manager for notifications', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const noEmailUser = {
      ...BASE_USER,
      id: 'u_noemail',
      email: null,
      displayName: 'Worker',
      lineManagerId: 'mgr_1'
    }
    mockGetUsersByCompany.mockResolvedValue([noEmailUser])
    mockResolveEmailRecipients.mockResolvedValue([
      { email: 'mgr@co.com', name: 'Manager' }
    ])

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        [{ email: 'mgr@co.com', name: 'Manager' }],
        'Farmyard Safety Checklist',
        null,
        expect.any(String)
      )
    )
  })

  it('does not fail assignment creation when notification throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockSendAssignmentNotification.mockRejectedValueOnce(new Error('ACS down'))

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/companies/[id]/assignments — individual user
// ---------------------------------------------------------------------------

describe('POST /api/admin/companies/[id]/assignments (individual user)', () => {
  it('returns 409 when template already assigned to that user', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetByTemplateAndUser.mockResolvedValue(USER_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', userId: 'user_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already assigned to this user/i)
  })

  it('returns 200 with new user-level assignment', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreate.mockResolvedValue(USER_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', userId: 'user_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignment.userId).toBe('user_123')
  })

  it('does not check company-level duplicate when userId is provided', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    // Even if a company-wide assignment exists, a user-level one is allowed
    mockGetByTemplateAndCompany.mockResolvedValue(BASE_ASSIGNMENT)
    mockCreate.mockResolvedValue(USER_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', userId: 'user_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect(mockGetByTemplateAndCompany).not.toHaveBeenCalled()
  })

  it('sends notification to the individual user', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreate.mockResolvedValue(USER_ASSIGNMENT)
    mockGetUserById.mockResolvedValue({
      ...BASE_USER,
      email: 'alice@co.com',
      displayName: 'Alice'
    })

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', userId: 'user_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        [{ email: 'alice@co.com', name: 'Alice' }],
        'Farmyard Safety Checklist',
        null,
        expect.any(String)
      )
    )
  })

  it('skips notification when user is not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreate.mockResolvedValue(USER_ASSIGNMENT)
    mockGetUserById.mockResolvedValue(null)

    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123', userId: 'user_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    // Allow fire-and-forget to settle, then confirm no send
    await new Promise((r) => setTimeout(r, 10))
    expect(mockSendAssignmentNotification).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/companies/[id]/assignments/[assignmentId]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/companies/[id]/assignments/[assignmentId]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/missing',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'missing')
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when assignment has existing completions', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockDelete.mockResolvedValue(false)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/completion/)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})
