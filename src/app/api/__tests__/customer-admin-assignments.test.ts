import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GET as listAssignments,
  POST as createAssignment
} from '../customer/admin/assignments/route'

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
  mockEnrollMatchingUsers
} = vi.hoisted(() => ({
  mockGetForCompany: vi.fn(),
  mockCreate: vi.fn(),
  mockGetByTemplateAndCompany: vi.fn(),
  mockEnrollMatchingUsers: vi.fn()
}))

vi.mock('@/lib/assignments', () => ({
  getAssignmentsForCompany: mockGetForCompany,
  createAssignment: mockCreate,
  getAssignmentByTemplateAndCompany: mockGetByTemplateAndCompany,
  enrollMatchingUsersForAssignment: mockEnrollMatchingUsers
}))

const { mockGetDocumentTemplateById } = vi.hoisted(() => ({
  mockGetDocumentTemplateById: vi.fn()
}))

vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetDocumentTemplateById
}))

const { mockGetUsersByCompany, mockResolveEmailRecipients } = vi.hoisted(
  () => ({
    mockGetUsersByCompany: vi.fn(),
    mockResolveEmailRecipients: vi.fn()
  })
)

vi.mock('@/lib/user-database', () => ({
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

const COMPANY_ADMIN_SESSION = {
  user: {
    id: 'ca_1',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_123'
  }
}
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Site Induction Checklist',
  description: null,
  blobPath: null,
  formSchema: null,
  questions: null,
  version: 1,
  ownerCompanyId: 'company_123',
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
  autoEnroll: false
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

beforeEach(() => {
  vi.clearAllMocks()
  mockGetForCompany.mockResolvedValue([])
  mockCreate.mockResolvedValue(BASE_ASSIGNMENT)
  mockGetByTemplateAndCompany.mockResolvedValue(null)
  mockEnrollMatchingUsers.mockResolvedValue([])
  mockGetDocumentTemplateById.mockResolvedValue(BASE_TEMPLATE)
  mockGetUsersByCompany.mockResolvedValue([BASE_USER])
  mockResolveEmailRecipients.mockImplementation((users: (typeof BASE_USER)[]) =>
    Promise.resolve(
      users
        .filter((u) => u.email)
        .map((u) => ({ email: u.email, name: u.displayName }))
    )
  )
  mockSendAssignmentNotification.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/customer/admin/assignments
// ---------------------------------------------------------------------------

describe('GET /api/customer/admin/assignments', () => {
  it('returns 403 when not a Customer Admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 200 with assignments scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetForCompany.mockResolvedValue([BASE_ASSIGNMENT])
    const res = await listAssignments()
    expect(res.status).toBe(200)
    expect(mockGetForCompany).toHaveBeenCalledWith('company_123')
    expect((await res.json()).assignments).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// POST /api/customer/admin/assignments
// ---------------------------------------------------------------------------

describe('POST /api/customer/admin/assignments', () => {
  it('returns 403 when not a Customer Admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when templateId is missing', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      {}
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetDocumentTemplateById.mockResolvedValue({
      ...BASE_TEMPLATE,
      ownerCompanyId: 'company_456'
    })
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when the template belongs to the tenant library (null owner)', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetDocumentTemplateById.mockResolvedValue({
      ...BASE_TEMPLATE,
      ownerCompanyId: null
    })
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 409 when already assigned to the company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetByTemplateAndCompany.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(409)
  })

  it('creates a company-wide assignment scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'template_123',
        customerCompanyId: 'company_123'
      })
    )
  })

  it('enrolls matching users when autoEnroll is set', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const autoEnrollAssignment = { ...BASE_ASSIGNMENT, autoEnroll: true }
    mockCreate.mockResolvedValue(autoEnrollAssignment)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123', autoEnroll: true }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(200)
    expect(mockEnrollMatchingUsers).toHaveBeenCalledWith(autoEnrollAssignment)
  })

  it('sends notifications to company users', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/customer/admin/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req)
    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(mockSendAssignmentNotification).toHaveBeenCalledWith(
        [{ email: 'user@company.com', name: 'Test User' }],
        'Site Induction Checklist',
        null,
        expect.any(String)
      )
    )
  })
})
