import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renewExpiringCompletions } from '../renewals'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    completionRecord: { findMany: vi.fn(), findFirst: vi.fn() },
    tenant: { aggregate: vi.fn() },
    assignment: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() }
  }
}))
vi.mock('../prisma', () => ({ default: mockPrisma }))

const { mockGetUserById, mockResolveEmailRecipients, mockGetLeadDays } =
  vi.hoisted(() => ({
    mockGetLeadDays: vi.fn(),
    mockGetUserById: vi.fn(),
    mockResolveEmailRecipients: vi.fn()
  }))
vi.mock('../user-database', () => ({
  getRenewalLeadDaysForCompany: mockGetLeadDays,
  getUserById: mockGetUserById,
  resolveEmailRecipients: mockResolveEmailRecipients
}))

const NOW = new Date('2026-06-01T00:00:00.000Z')
const VALID_UNTIL = new Date('2026-06-20T00:00:00.000Z')

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'completion_1',
    signedById: 'user_1',
    validUntil: VALID_UNTIL,
    assignment: {
      id: 'assignment_1',
      templateId: 'template_1',
      customerCompanyId: 'company_1',
      templateVersion: 2,
      cycle: 1,
      recurrenceMonths: 12,
      template: { title: 'Fire Safety Briefing' }
    },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.tenant.aggregate.mockResolvedValue({
    _max: { renewalLeadDays: 30 }
  })
  mockGetLeadDays.mockResolvedValue(30)
  mockPrisma.completionRecord.findMany.mockResolvedValue([record()])
  mockPrisma.completionRecord.findFirst.mockResolvedValue(null)
  mockPrisma.assignment.findFirst.mockResolvedValue(null)
  mockPrisma.assignment.create.mockResolvedValue({ id: 'renewal_1' })
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'user_1',
    customerCompanyId: 'company_1',
    jobRole: null
  })
  mockGetUserById.mockResolvedValue({ id: 'user_1' })
  mockResolveEmailRecipients.mockResolvedValue([
    { email: 'alice@co.com', name: 'Alice' }
  ])
})

describe('renewExpiringCompletions', () => {
  it('queries completions expiring within the renewal window', async () => {
    await renewExpiringCompletions(NOW)
    const where = mockPrisma.completionRecord.findMany.mock.calls[0][0].where
    expect(where.validUntil.not).toBeNull()
    expect(where.validUntil.lte.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('widens the query to the longest tenant lead time', async () => {
    mockPrisma.tenant.aggregate.mockResolvedValue({
      _max: { renewalLeadDays: 60 }
    })
    await renewExpiringCompletions(NOW)
    const where = mockPrisma.completionRecord.findMany.mock.calls[0][0].where
    expect(where.validUntil.lte.toISOString()).toBe('2026-07-31T00:00:00.000Z')
  })

  it('falls back to the default window when no tenant exists', async () => {
    mockPrisma.tenant.aggregate.mockResolvedValue({
      _max: { renewalLeadDays: null }
    })
    await renewExpiringCompletions(NOW)
    const where = mockPrisma.completionRecord.findMany.mock.calls[0][0].where
    expect(where.validUntil.lte.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it("applies the company's own lead time, skipping completions still outside it", async () => {
    mockGetLeadDays.mockResolvedValue(7) // expiry is 19 days out
    expect(await renewExpiringCompletions(NOW)).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()

    mockGetLeadDays.mockResolvedValue(21)
    expect(await renewExpiringCompletions(NOW)).toHaveLength(1)
  })

  it('looks up each company lead time once', async () => {
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      record(),
      record({ id: 'c2', signedById: 'user_2' })
    ])
    await renewExpiringCompletions(NOW)
    expect(mockGetLeadDays).toHaveBeenCalledTimes(1)
    expect(mockGetLeadDays).toHaveBeenCalledWith('company_1')
  })

  it('creates the next cycle as an individual assignment due at expiry', async () => {
    const result = await renewExpiringCompletions(NOW)

    expect(mockPrisma.assignment.create).toHaveBeenCalledWith({
      data: {
        templateId: 'template_1',
        customerCompanyId: 'company_1',
        userId: 'user_1',
        dueDate: VALID_UNTIL,
        templateVersion: 2,
        cycle: 2,
        recurrenceMonths: 12,
        autoEnroll: false
      }
    })
    expect(result).toEqual([
      {
        assignmentId: 'renewal_1',
        templateTitle: 'Fire Safety Briefing',
        dueDate: VALID_UNTIL.toISOString(),
        recipients: [{ email: 'alice@co.com', name: 'Alice' }]
      }
    ])
  })

  it('routes recipients through line-manager resolution', async () => {
    mockResolveEmailRecipients.mockResolvedValue([
      { email: 'manager@co.com', name: 'Manager' }
    ])
    const result = await renewExpiringCompletions(NOW)
    expect(mockResolveEmailRecipients).toHaveBeenCalledWith([{ id: 'user_1' }])
    expect(result[0].recipients[0].email).toBe('manager@co.com')
  })

  it('skips when the user has since re-signed with a later or no expiry', async () => {
    mockPrisma.completionRecord.findFirst.mockResolvedValue({ id: 'newer' })
    expect(await renewExpiringCompletions(NOW)).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('skips when a newer cycle already exists (idempotent re-run)', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue({
      id: 'existing',
      userId: 'user_1',
      targetJobRoles: null
    })
    expect(await renewExpiringCompletions(NOW)).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('skips when a newer company-wide version applies to the user', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue({
      id: 'v3',
      userId: null,
      targetJobRoles: ['Driver']
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      customerCompanyId: 'company_1',
      jobRole: 'Driver'
    })
    expect(await renewExpiringCompletions(NOW)).toEqual([])
  })

  it('still renews when the newer company-wide version targets other job roles', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue({
      id: 'v3',
      userId: null,
      targetJobRoles: ['Driver']
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      customerCompanyId: 'company_1',
      jobRole: 'Cleaner'
    })
    expect(await renewExpiringCompletions(NOW)).toHaveLength(1)
  })

  it('skips users who no longer exist or moved company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect(await renewExpiringCompletions(NOW)).toEqual([])

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      customerCompanyId: 'other_company',
      jobRole: null
    })
    expect(await renewExpiringCompletions(NOW)).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('renews once per user and template, using the latest completion', async () => {
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      record(),
      record({ id: 'completion_0', validUntil: new Date('2026-05-01') })
    ])
    await renewExpiringCompletions(NOW)
    expect(mockPrisma.assignment.create).toHaveBeenCalledTimes(1)
  })

  it('returns an empty recipient list when the signer cannot be resolved', async () => {
    mockGetUserById.mockResolvedValue(null)
    const result = await renewExpiringCompletions(NOW)
    expect(result[0].recipients).toEqual([])
  })
})
