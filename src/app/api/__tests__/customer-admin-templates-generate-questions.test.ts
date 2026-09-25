import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as generateQuestions } from '../customer/admin/templates/[id]/generate-questions/route'

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

const { mockGetTemplateSourceText } = vi.hoisted(() => ({
  mockGetTemplateSourceText: vi.fn()
}))
vi.mock('@/lib/comprehension-question-source', () => ({
  getTemplateSourceText: mockGetTemplateSourceText
}))

const { mockGenerateComprehensionQuestions } = vi.hoisted(() => ({
  mockGenerateComprehensionQuestions: vi.fn()
}))
vi.mock('@/lib/comprehension-question-generation', () => ({
  generateComprehensionQuestions: mockGenerateComprehensionQuestions
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ADMIN_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_123'
  }
}
const NO_COMPANY_SESSION = {
  user: { id: 'user_123', roles: ['Customer Admin'], customerCompanyId: null }
}
const CUSTOMER_USER_SESSION = {
  user: {
    id: 'user_456',
    roles: ['Customer User'],
    customerCompanyId: 'company_123'
  }
}

const OWNED_TEMPLATE = {
  id: 'template_123',
  title: 'Site Induction Checklist',
  description: 'Covers site rules and PPE.',
  sourceType: 'form',
  ownerCompanyId: 'company_123'
}

const OTHER_COMPANY_TEMPLATE = {
  ...OWNED_TEMPLATE,
  ownerCompanyId: 'company_456'
}

const TENANT_LIBRARY_TEMPLATE = {
  ...OWNED_TEMPLATE,
  ownerCompanyId: null
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function req(id: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/customer/admin/templates/${id}/generate-questions`,
    { method: 'POST' }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetById.mockResolvedValue(null)
})

describe('POST /api/customer/admin/templates/[id]/generate-questions', () => {
  it('returns 403 for non-Customer-Admin roles', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_USER_SESSION)
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when the session has no company assigned', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when template not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const res = await generateQuestions(req('missing'), params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the template belongs to another company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(OTHER_COMPANY_TEMPLATE)
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when the template belongs to the tenant library', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(TENANT_LIBRARY_TEMPLATE)
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when source text cannot be derived', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(OWNED_TEMPLATE)
    mockGetTemplateSourceText.mockRejectedValue(
      new Error('Could not extract readable text from this document.')
    )
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Could not extract readable text/)
  })

  it('returns 500 when generation fails', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(OWNED_TEMPLATE)
    mockGetTemplateSourceText.mockResolvedValue('source text')
    mockGenerateComprehensionQuestions.mockRejectedValue(new Error('boom'))
    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )
    expect(res.status).toBe(500)
  })

  it('returns 200 with the generated questions on success', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockGetById.mockResolvedValue(OWNED_TEMPLATE)
    mockGetTemplateSourceText.mockResolvedValue('source text')
    const questions = [
      {
        id: 'q1',
        question: 'What must be worn on site?',
        options: ['PPE', 'Nothing'],
        answer: 'PPE'
      }
    ]
    mockGenerateComprehensionQuestions.mockResolvedValue(questions)

    const res = await generateQuestions(
      req('template_123'),
      params('template_123')
    )

    expect(res.status).toBe(200)
    expect((await res.json()).questions).toEqual(questions)
    expect(mockGetTemplateSourceText).toHaveBeenCalledWith(OWNED_TEMPLATE)
    expect(mockGenerateComprehensionQuestions).toHaveBeenCalledWith(
      'source text'
    )
  })
})
