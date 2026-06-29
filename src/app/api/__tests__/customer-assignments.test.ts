import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as completeAssignment } from '../customer/assignments/[id]/complete/route'
import { GET as downloadAssignment } from '../customer/assignments/[id]/download/route'
import { GET as getAssignment } from '../customer/assignments/[id]/route'
import { GET as listAssignments } from '../customer/assignments/route'
import { GET as downloadCompletion } from '../customer/completions/[id]/download/route'
import { GET as listCompletions } from '../customer/completions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAssignmentsForUser, mockGetById, mockGetWithTemplate } =
  vi.hoisted(() => ({
    mockGetAssignmentsForUser: vi.fn(),
    mockGetById: vi.fn(),
    mockGetWithTemplate: vi.fn()
  }))
vi.mock('@/lib/assignments', () => ({
  getAssignmentsForUser: mockGetAssignmentsForUser,
  getAssignmentById: mockGetById,
  getAssignmentWithTemplate: mockGetWithTemplate
}))

const { mockGetTemplateById } = vi.hoisted(() => ({
  mockGetTemplateById: vi.fn()
}))
vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetTemplateById
}))

const { mockGenerateDownloadUrl } = vi.hoisted(() => ({
  mockGenerateDownloadUrl: vi.fn()
}))
vi.mock('@/lib/file-system', () => ({
  getFileManager: () => ({ generateDownloadUrl: mockGenerateDownloadUrl })
}))

const {
  mockCreateCompletion,
  mockGetForUser,
  mockUpdateBlobPath,
  mockGetCompletionById
} = vi.hoisted(() => ({
  mockCreateCompletion: vi.fn(),
  mockGetForUser: vi.fn(),
  mockUpdateBlobPath: vi.fn(),
  mockGetCompletionById: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  createCompletionRecord: mockCreateCompletion,
  getCompletionsForUser: mockGetForUser,
  updateCompletionBlobPath: mockUpdateBlobPath,
  getCompletionById: mockGetCompletionById
}))

// Mock customer-companies to avoid DB calls in complete route
const { mockGetCompanyById } = vi.hoisted(() => ({
  mockGetCompanyById: vi.fn()
}))
vi.mock('@/lib/customer-companies', () => ({
  getCustomerCompanyById: mockGetCompanyById
}))

// Mock PDF generation and blob upload in the complete route
vi.mock('@/lib/pdf/completion-pdf', () => ({
  generateCompletionPDF: vi.fn().mockResolvedValue(Buffer.from('pdf'))
}))
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        getBlockBlobClient: () => ({
          uploadData: vi.fn().mockResolvedValue(undefined)
        })
      })
    })
  }
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

const CUSTOMER_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer User'],
    customerCompanyId: 'company_123',
    jobRole: null
  }
}
const CUSTOMER_SESSION_WITH_NAME = {
  user: {
    id: 'user_123',
    name: 'Jane Smith',
    roles: ['Customer User'],
    customerCompanyId: 'company_123',
    jobRole: null
  }
}
const NO_COMPANY_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer User'],
    customerCompanyId: null,
    jobRole: null
  }
}
const ADMIN_SESSION = {
  user: {
    id: 'admin_123',
    roles: ['Tenant Admin'],
    customerCompanyId: null,
    jobRole: null
  }
}

const BASE_ASSIGNMENT = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  template: {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: null,
    blobPath: null,
    formSchema: null
  }
}

const BASE_ASSIGNMENT_WITH_SCHEMA = {
  ...BASE_ASSIGNMENT,
  template: {
    ...BASE_ASSIGNMENT.template,
    formSchema: [
      {
        id: 'q1',
        label: 'Are fire exits clear?',
        type: 'checkbox',
        required: true
      },
      { id: 'q2', label: 'Supervisor name', type: 'text', required: true }
    ]
  }
}

// Assignment whose template has comprehension questions (answers stripped for client)
const ASSIGNMENT_WITH_QUESTIONS = {
  ...BASE_ASSIGNMENT,
  template: {
    ...BASE_ASSIGNMENT.template,
    questions: [
      {
        id: 'cq1',
        question: 'What is the evacuation procedure?',
        options: ['evacuate', 'stay put', 'call a colleague']
      },
      {
        id: 'cq2',
        question: 'Where is the fire extinguisher located?',
        options: ['Near the main entrance', 'In the car park', 'In the kitchen']
      }
    ]
  }
}

// Full template returned by getDocumentTemplateById — includes correct answers
const TEMPLATE_WITH_QUESTIONS = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: null,
  blobPath: null,
  formSchema: null,
  questions: [
    {
      id: 'cq1',
      question: 'What is the evacuation procedure?',
      options: ['evacuate', 'stay put', 'call a colleague'],
      answer: 'evacuate'
    },
    {
      id: 'cq2',
      question: 'Where is the fire extinguisher located?',
      options: ['Near the main entrance', 'In the car park', 'In the kitchen'],
      answer: 'Near the main entrance'
    }
  ],
  tenantId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}

// Schema with a conditional field: q2 is only shown (and required) when q1 is No (false)
const ASSIGNMENT_WITH_CONDITIONAL_SCHEMA = {
  ...BASE_ASSIGNMENT,
  template: {
    ...BASE_ASSIGNMENT.template,
    formSchema: [
      {
        id: 'q1',
        label: 'Are fire exits clear?',
        type: 'checkbox',
        required: false
      },
      {
        id: 'q2',
        label: 'Describe what is blocking exits',
        type: 'text',
        required: true,
        condition: { fieldId: 'q1', value: false }
      }
    ]
  }
}

const BASE_COMPLETION = {
  id: 'record_123',
  assignmentId: 'assignment_123',
  signedById: 'user_123',
  signedAt: '2024-01-01T00:00:00.000Z',
  blobPath: null,
  formData: null,
  assignment: {
    id: 'assignment_123',
    templateId: 'template_123',
    template: {
      id: 'template_123',
      title: 'Farmyard Safety Checklist',
      description: null
    }
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function jsonRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAssignmentsForUser.mockResolvedValue([])
  mockGetById.mockResolvedValue(null)
  mockGetWithTemplate.mockResolvedValue(null)
  mockCreateCompletion.mockResolvedValue(BASE_COMPLETION)
  mockGetForUser.mockResolvedValue([])
  mockGetTemplateById.mockResolvedValue(null)
  mockGenerateDownloadUrl.mockResolvedValue(null)
  mockUpdateBlobPath.mockResolvedValue(true)
  mockGetCompletionById.mockResolvedValue(null)
  mockGetCompanyById.mockResolvedValue({ id: 'company_123', name: 'Acme Farm' })
  mockGenerateSasToken.mockResolvedValue('https://blob.example.com/sas-url')
})

// ---------------------------------------------------------------------------
// GET /api/customer/assignments
// ---------------------------------------------------------------------------

describe('GET /api/customer/assignments', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role (not a customer)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 403 when customer has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 200 with assignments for the user (company-wide + individual)', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetAssignmentsForUser.mockResolvedValue([BASE_ASSIGNMENT])
    const res = await listAssignments()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(1)
    expect(body.assignments[0].template.title).toBe('Farmyard Safety Checklist')
  })

  it('passes jobRole from session to getAssignmentsForUser', async () => {
    const sessionWithJobRole = {
      user: {
        ...CUSTOMER_SESSION.user,
        jobRole: 'Site Manager'
      }
    }
    mockGetServerSession.mockResolvedValue(sessionWithJobRole)
    mockGetAssignmentsForUser.mockResolvedValue([])
    await listAssignments()
    expect(mockGetAssignmentsForUser).toHaveBeenCalledWith(
      'user_123',
      'company_123',
      'Site Manager'
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/assignments/[id]
// ---------------------------------------------------------------------------

describe('GET /api/customer/assignments/[id]', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123'
    )
    const res = await getAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123'
    )
    const res = await getAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/missing'
    )
    const res = await getAssignment(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123'
    )
    const res = await getAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with assignment including formSchema', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT_WITH_SCHEMA)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123'
    )
    const res = await getAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignment.template.formSchema).toHaveLength(2)
    expect(body.assignment.template.formSchema[0].label).toBe(
      'Are fire exits clear?'
    )
  })
})

// ---------------------------------------------------------------------------
// POST /api/customer/assignments/[id]/complete
// ---------------------------------------------------------------------------

describe('POST /api/customer/assignments/[id]/complete', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete'
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/missing/complete'
    )
    const res = await completeAssignment(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete'
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields are missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT_WITH_SCHEMA)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required fields missing/i)
    expect(body.error).toMatch(/Are fire exits clear\?/)
    expect(body.error).toMatch(/Supervisor name/)
  })

  it('returns 400 when required checkbox is not checked', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT_WITH_SCHEMA)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: { q1: false, q2: 'Jane' }, declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Are fire exits clear\?/)
  })

  it('returns 400 when declarationName is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {} }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/declaration name/i)
  })

  it('returns 400 when declarationName is blank whitespace', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: '   ' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/declaration name/i)
  })

  it('returns 200 with completion record when all required fields provided', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT_WITH_SCHEMA)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      {
        formData: { q1: true, q2: 'Jane Smith' },
        declarationName: 'Jane Smith'
      }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completion.assignmentId).toBe('assignment_123')
    expect(body.completion.signedById).toBe('user_123')
  })

  it('skips required validation for a field whose condition is not met', async () => {
    // q1 = true (Yes, exits are clear) → q2 condition (value: false) not met → q2 hidden → valid
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_CONDITIONAL_SCHEMA)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: { q1: true }, declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
  })

  it('enforces required validation for a field whose condition is met', async () => {
    // q1 = false (No, exits are blocked) → q2 condition (value: false) met → q2 visible and required
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_CONDITIONAL_SCHEMA)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: { q1: false }, declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Describe what is blocking exits/)
  })

  it('returns 200 for template with no form schema', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completion.assignmentId).toBe('assignment_123')
    expect(body.completion.signedById).toBe('user_123')
  })

  it('returns 400 with failedQuestionIds when no answers provided for questions', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_QUESTIONS)
    mockGetTemplateById.mockResolvedValue(TEMPLATE_WITH_QUESTIONS)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: 'Jane Smith' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.failedQuestionIds).toContain('cq1')
    expect(body.failedQuestionIds).toContain('cq2')
  })

  it('returns 400 with failedQuestionIds when answers are wrong', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_QUESTIONS)
    mockGetTemplateById.mockResolvedValue(TEMPLATE_WITH_QUESTIONS)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      {
        formData: {},
        answers: [
          { id: 'cq1', answer: 'wrong answer' },
          { id: 'cq2', answer: 'Near the main entrance' }
        ],
        declarationName: 'Jane Smith'
      }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.failedQuestionIds).toContain('cq1')
    expect(body.failedQuestionIds).not.toContain('cq2')
  })

  it('returns 200 when all comprehension answers are correct (case-insensitive)', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_QUESTIONS)
    mockGetTemplateById.mockResolvedValue(TEMPLATE_WITH_QUESTIONS)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      {
        formData: {},
        answers: [
          { id: 'cq1', answer: '  Evacuate  ' }, // extra whitespace + different case
          { id: 'cq2', answer: 'near the main entrance' }
        ],
        declarationName: 'Jane Smith'
      }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
  })

  it('returns 400 when declarationName does not match session user name', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION_WITH_NAME)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: 'Wrong Name' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/match your account name/i)
    expect(body.nameError).toBe(true)
  })

  it('accepts declarationName matching session user name case-insensitively with extra whitespace', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION_WITH_NAME)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: '  jane smith  ' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
  })

  it('skips name matching when session has no name set', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete',
      { formData: {}, declarationName: 'Any Name At All' }
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/completions
// ---------------------------------------------------------------------------

describe('GET /api/customer/completions', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 200 with completions', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetForUser.mockResolvedValue([BASE_COMPLETION])
    const res = await listCompletions()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].assignment.template.title).toBe(
      'Farmyard Safety Checklist'
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/assignments/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/customer/assignments/[id]/download', () => {
  const BASE_TEMPLATE_WITH_BLOB = {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: null,
    blobPath: 'templates/farmyard-safety.pdf',
    formSchema: null,
    tenantId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }

  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/missing/download'
    )
    const res = await downloadAssignment(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when template has no file', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockGetTemplateById.mockResolvedValue({
      ...BASE_TEMPLATE_WITH_BLOB,
      blobPath: null
    })
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/no file/i)
  })

  it('returns 200 with a download URL', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockGetTemplateById.mockResolvedValue(BASE_TEMPLATE_WITH_BLOB)
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://blob.example.com/sas-url'
    )
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.example.com/sas-url')
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/completions/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/customer/completions/[id]/download', () => {
  const BASE_COMPLETION_WITH_PDF = {
    id: 'record_123',
    assignmentId: 'assignment_123',
    signedById: 'user_123',
    signedAt: '2024-01-01T00:00:00.000Z',
    blobPath: 'completions/record_123.pdf',
    formData: null
  }

  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/customer/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when completion not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompletionById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/completions/missing/download'
    )
    const res = await downloadCompletion(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion belongs to a different user', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompletionById.mockResolvedValue({
      ...BASE_COMPLETION_WITH_PDF,
      signedById: 'other_user'
    })
    const req = new NextRequest(
      'http://localhost/api/customer/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion has no PDF', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompletionById.mockResolvedValue({
      ...BASE_COMPLETION_WITH_PDF,
      blobPath: null
    })
    const req = new NextRequest(
      'http://localhost/api/customer/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/pdf not available/i)
  })

  it('returns 200 with download URL', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompletionById.mockResolvedValue(BASE_COMPLETION_WITH_PDF)
    const req = new NextRequest(
      'http://localhost/api/customer/completions/record_123/download'
    )
    const res = await downloadCompletion(req, params('record_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.example.com/sas-url')
  })
})
