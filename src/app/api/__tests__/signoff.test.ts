import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as completeKiosk } from '../signoff/[companyId]/[assignmentId]/route'
import { GET as getKioskData } from '../signoff/[companyId]/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetCompanyById } = vi.hoisted(() => ({
  mockGetCompanyById: vi.fn()
}))
vi.mock('@/lib/customer-companies', () => ({
  getCustomerCompanyById: mockGetCompanyById
}))

const { mockGetNoEmailUsersByCompany, mockGetUserById } = vi.hoisted(() => ({
  mockGetNoEmailUsersByCompany: vi.fn(),
  mockGetUserById: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getNoEmailUsersByCompany: mockGetNoEmailUsersByCompany,
  getUserById: mockGetUserById
}))

const { mockGetAssignmentsForUser } = vi.hoisted(() => ({
  mockGetAssignmentsForUser: vi.fn()
}))

const { mockGetAssignmentWithTemplate } = vi.hoisted(() => ({
  mockGetAssignmentWithTemplate: vi.fn()
}))

const { mockGetDocumentTemplateById } = vi.hoisted(() => ({
  mockGetDocumentTemplateById: vi.fn()
}))

vi.mock('@/lib/assignments', () => ({
  getAssignmentsForUser: mockGetAssignmentsForUser,
  getAssignmentWithTemplate: mockGetAssignmentWithTemplate
}))

vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetDocumentTemplateById
}))

const {
  mockCreateCompletionRecord,
  mockUpdateBlobPath,
  mockGetCompletionsForUser
} = vi.hoisted(() => ({
  mockCreateCompletionRecord: vi.fn(),
  mockUpdateBlobPath: vi.fn(),
  mockGetCompletionsForUser: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  createCompletionRecord: mockCreateCompletionRecord,
  updateCompletionBlobPath: mockUpdateBlobPath,
  getCompletionsForUser: mockGetCompletionsForUser
}))

vi.mock('@/lib/pdf/completion-pdf', () => ({
  generateCompletionPDF: vi.fn().mockResolvedValue(Buffer.from('pdf'))
}))
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        getBlockBlobClient: () => ({ uploadData: vi.fn() })
      })
    })
  }
}))
vi.mock('@/lib/version-manager', () => ({
  generateVersionId: () => 'v1'
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPANY = { id: 'co_1', name: 'Acme Ltd', folderPath: null }

const NO_EMAIL_WORKER = {
  id: 'worker_1',
  email: null,
  displayName: 'Bob',
  passwordHash: null,
  role: 'Customer User',
  jobRole: null,
  lineManagerId: 'mgr_1',
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: 'co_1'
}

const ASSIGNMENT = {
  id: 'asgn_1',
  templateId: 'tmpl_1',
  customerCompanyId: 'co_1',
  userId: null,
  dueDate: null,
  targetJobRoles: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  template: {
    id: 'tmpl_1',
    title: 'Safety Doc',
    description: null,
    blobPath: null,
    formSchema: null,
    questions: null
  }
}

const COMPLETION_RECORD = {
  id: 'rec_1',
  assignmentId: 'asgn_1',
  signedById: 'worker_1',
  signedAt: new Date().toISOString(),
  blobPath: null,
  formData: null
}

function makeGetRequest(companyId: string): NextRequest {
  return new NextRequest(`http://localhost/api/signoff/${companyId}`)
}

function makePostRequest(
  companyId: string,
  assignmentId: string,
  body: object
): NextRequest {
  return new NextRequest(
    `http://localhost/api/signoff/${companyId}/${assignmentId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerSession.mockResolvedValue(null)
  mockGetCompanyById.mockResolvedValue(COMPANY)
  mockGetNoEmailUsersByCompany.mockResolvedValue([NO_EMAIL_WORKER])
  mockGetAssignmentsForUser.mockResolvedValue([ASSIGNMENT])
  mockGetCompletionsForUser.mockResolvedValue([])
  mockGetUserById.mockResolvedValue(NO_EMAIL_WORKER)
  mockGetAssignmentWithTemplate.mockResolvedValue(ASSIGNMENT)
  mockGetDocumentTemplateById.mockResolvedValue({ questions: null })
  mockCreateCompletionRecord.mockResolvedValue(COMPLETION_RECORD)
  mockUpdateBlobPath.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/signoff/[companyId]
// ---------------------------------------------------------------------------

describe('GET /api/signoff/[companyId]', () => {
  it('returns company and workers with their assignments', async () => {
    const req = makeGetRequest('co_1')
    const res = await getKioskData(req, {
      params: Promise.resolve({ companyId: 'co_1' })
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.company.name).toBe('Acme Ltd')
    expect(body.workers).toHaveLength(1)
    expect(body.workers[0].displayName).toBe('Bob')
    expect(body.workers[0].assignments).toHaveLength(1)
    expect(body.workers[0].assignments[0].template.title).toBe('Safety Doc')
  })

  it('returns 404 when company not found', async () => {
    mockGetCompanyById.mockResolvedValue(null)
    const req = makeGetRequest('bad_co')
    const res = await getKioskData(req, {
      params: Promise.resolve({ companyId: 'bad_co' })
    })
    expect(res.status).toBe(404)
  })

  it('returns empty workers array when company has no no-email workers', async () => {
    mockGetNoEmailUsersByCompany.mockResolvedValue([])
    const req = makeGetRequest('co_1')
    const res = await getKioskData(req, {
      params: Promise.resolve({ companyId: 'co_1' })
    })
    const body = await res.json()
    expect(body.workers).toHaveLength(0)
  })

  it('excludes assignments the worker has already completed', async () => {
    mockGetCompletionsForUser.mockResolvedValue([
      { assignmentId: 'asgn_1', signedById: 'worker_1' }
    ])
    const req = makeGetRequest('co_1')
    const res = await getKioskData(req, {
      params: Promise.resolve({ companyId: 'co_1' })
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.workers[0].assignments).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// POST /api/signoff/[companyId]/[assignmentId]
// ---------------------------------------------------------------------------

describe('POST /api/signoff/[companyId]/[assignmentId]', () => {
  it('records a kiosk completion for a no-email worker', async () => {
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.completion.id).toBe('rec_1')
    expect(mockCreateCompletionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ signedById: 'worker_1' })
    )
  })

  it('returns 400 when workerId is missing', async () => {
    const req = makePostRequest('co_1', 'asgn_1', {})
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(400)
  })

  it('returns 403 when worker is not a no-email user', async () => {
    // Worker has an email → not eligible for kiosk
    mockGetUserById.mockResolvedValue({
      ...NO_EMAIL_WORKER,
      email: 'hasEmail@co.com'
    })
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(403)
  })

  it('returns 403 when worker belongs to a different company', async () => {
    mockGetUserById.mockResolvedValue({
      ...NO_EMAIL_WORKER,
      customerCompanyId: 'other_co'
    })
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetAssignmentWithTemplate.mockResolvedValue({
      ...ASSIGNMENT,
      customerCompanyId: 'other_co'
    })
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when individual assignment does not belong to this worker', async () => {
    mockGetAssignmentWithTemplate.mockResolvedValue({
      ...ASSIGNMENT,
      userId: 'other_worker'
    })
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 on incorrect comprehension answers', async () => {
    mockGetDocumentTemplateById.mockResolvedValue({
      questions: [
        { id: 'q1', question: 'Q?', options: ['A', 'B'], answer: 'A' }
      ]
    })
    const req = makePostRequest('co_1', 'asgn_1', {
      workerId: 'worker_1',
      answers: [{ id: 'q1', answer: 'B' }]
    })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.failedQuestionIds).toContain('q1')
  })

  it('accepts correct comprehension answers', async () => {
    mockGetDocumentTemplateById.mockResolvedValue({
      questions: [
        { id: 'q1', question: 'Q?', options: ['A', 'B'], answer: 'A' }
      ]
    })
    const req = makePostRequest('co_1', 'asgn_1', {
      workerId: 'worker_1',
      answers: [{ id: 'q1', answer: 'A' }]
    })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when company not found', async () => {
    mockGetCompanyById.mockResolvedValue(null)
    const req = makePostRequest('bad_co', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'bad_co', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when request comes from an authenticated session', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } })
    const req = makePostRequest('co_1', 'asgn_1', { workerId: 'worker_1' })
    const res = await completeKiosk(req, {
      params: Promise.resolve({ companyId: 'co_1', assignmentId: 'asgn_1' })
    })
    expect(res.status).toBe(403)
  })
})
