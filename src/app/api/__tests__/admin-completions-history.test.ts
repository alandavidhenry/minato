import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getCompletionsHistory } from '../admin/completions/history/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAllCompletionsForAdmin } = vi.hoisted(() => ({
  mockGetAllCompletionsForAdmin: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  getAllCompletionsForAdmin: mockGetAllCompletionsForAdmin
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_COMPLETION = {
  id: 'record_123',
  signedAt: '2026-07-10T00:00:00.000Z',
  blobPath: 'completions/record_123.pdf',
  signer: {
    id: 'user_123',
    displayName: 'Jane Smith',
    email: 'jane@example.com'
  },
  assignment: {
    id: 'assignment_123',
    template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
    customerCompany: { id: 'company_123', name: 'Acme Farm' }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllCompletionsForAdmin.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions/history
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions/history', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await getCompletionsHistory()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await getCompletionsHistory()
    expect(res.status).toBe(403)
  })

  it('returns 200 with an empty list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await getCompletionsHistory()
    expect(res.status).toBe(200)
    expect((await res.json()).completions).toEqual([])
  })

  it('returns 200 with completions', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAllCompletionsForAdmin.mockResolvedValue([BASE_COMPLETION])
    const res = await getCompletionsHistory()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].signer.displayName).toBe('Jane Smith')
    expect(body.completions[0].assignment.customerCompany.name).toBe(
      'Acme Farm'
    )
  })

  it('returns 500 when getAllCompletionsForAdmin throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAllCompletionsForAdmin.mockRejectedValue(new Error('DB error'))
    const res = await getCompletionsHistory()
    expect(res.status).toBe(500)
  })
})
