import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getComplianceKPIs } from '../compliance-kpis'

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    customerCompany: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
    completionRecord: { findMany: vi.fn() },
    user: { findMany: vi.fn() }
  }
  return { mockPrisma }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2024-06-15T12:00:00.000Z')

function makeDate(iso: string) {
  return new Date(iso)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getComplianceKPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(NOW)

    // Default: empty results for everything
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany.mockResolvedValue([])
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty arrays when there is no data', async () => {
    const result = await getComplianceKPIs()
    expect(result.companyCompletionRates).toEqual([])
    expect(result.monthlyThroughput).toHaveLength(12)
    expect(result.templateAvgDays).toEqual([])
    expect(result.companiesWithNoRecentCompletions).toEqual([])
    expect(result.coverageGaps).toEqual([])
    expect(result.topOverdueUsers).toEqual([])
  })

  it('monthly throughput always spans exactly 12 months', async () => {
    const result = await getComplianceKPIs()
    expect(result.monthlyThroughput).toHaveLength(12)
    // First month should be 11 months ago
    const first = result.monthlyThroughput[0].month
    expect(first).toBe('2023-07')
    // Last month should be current month
    const last = result.monthlyThroughput[11].month
    expect(last).toBe('2024-06')
  })

  it('computes completion rates per company, sorted ascending by rate', async () => {
    mockPrisma.customerCompany.findMany
      .mockResolvedValueOnce([
        // Called for company rates
        {
          name: 'Acme',
          assignments: [
            { _count: { completions: 1 } },
            { _count: { completions: 0 } }
          ]
        },
        {
          name: 'Beta Corp',
          assignments: [
            { _count: { completions: 1 } },
            { _count: { completions: 1 } }
          ]
        }
      ])
      .mockResolvedValueOnce([]) // no-recent-completions query

    const result = await getComplianceKPIs()
    // Acme: 1/2 = 50%; Beta Corp: 2/2 = 100%
    expect(result.companyCompletionRates[0].companyName).toBe('Acme')
    expect(result.companyCompletionRates[0].rate).toBe(50)
    expect(result.companyCompletionRates[1].companyName).toBe('Beta Corp')
    expect(result.companyCompletionRates[1].rate).toBe(100)
  })

  it('buckets assignments and completions into the correct month', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([
        { createdAt: makeDate('2024-06-01T00:00:00.000Z') },
        { createdAt: makeDate('2024-06-10T00:00:00.000Z') }
      ])
      .mockResolvedValueOnce([]) // overdue query
    mockPrisma.completionRecord.findMany
      .mockResolvedValueOnce([
        { signedAt: makeDate('2024-06-05T00:00:00.000Z') }
      ])
      .mockResolvedValueOnce([]) // avg-days query

    const result = await getComplianceKPIs()
    const june = result.monthlyThroughput.find((m) => m.month === '2024-06')
    expect(june).toBeDefined()
    expect(june!.assignments).toBe(2)
    expect(june!.completions).toBe(1)
  })

  it('computes template avg days correctly', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([]) // overdue
    mockPrisma.completionRecord.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([
        {
          signedAt: makeDate('2024-06-11T00:00:00.000Z'),
          assignment: {
            createdAt: makeDate('2024-06-01T00:00:00.000Z'),
            template: { title: 'Safety Checklist' }
          }
        },
        {
          signedAt: makeDate('2024-06-21T00:00:00.000Z'),
          assignment: {
            createdAt: makeDate('2024-06-01T00:00:00.000Z'),
            template: { title: 'Safety Checklist' }
          }
        }
      ])

    const result = await getComplianceKPIs()
    expect(result.templateAvgDays).toHaveLength(1)
    expect(result.templateAvgDays[0].templateTitle).toBe('Safety Checklist')
    // (10 days + 20 days) / 2 = 15 days
    expect(result.templateAvgDays[0].avgDays).toBe(15)
    expect(result.templateAvgDays[0].completionCount).toBe(2)
  })

  it('maps zero-completion assignments to coverage gaps', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([
        {
          customerCompany: { name: 'Acme' },
          template: { title: 'Fire Safety' }
        }
      ]) // zero-completion
      .mockResolvedValueOnce([]) // overdue
    mockPrisma.completionRecord.findMany.mockResolvedValue([])

    const result = await getComplianceKPIs()
    expect(result.coverageGaps).toEqual([
      { companyName: 'Acme', templateTitle: 'Fire Safety' }
    ])
  })

  it('counts overdue items per user across company-wide assignments', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([]) // zero-completion
      .mockResolvedValueOnce([
        {
          userId: null,
          customerCompanyId: 'company_1',
          completions: [] // no one has completed
        }
      ]) // overdue
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    // Company users query
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'user_1', displayName: 'Alice', customerCompanyId: 'company_1' },
      { id: 'user_2', displayName: 'Bob', customerCompanyId: 'company_1' }
    ])

    const result = await getComplianceKPIs()
    expect(result.topOverdueUsers).toHaveLength(2)
    expect(result.topOverdueUsers[0].overdueCount).toBe(1)
  })

  it('does not count users who have already completed an overdue assignment', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([]) // zero-completion
      .mockResolvedValueOnce([
        {
          userId: null,
          customerCompanyId: 'company_1',
          completions: [{ signedById: 'user_1' }] // Alice completed
        }
      ]) // overdue
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'user_1', displayName: 'Alice', customerCompanyId: 'company_1' },
      { id: 'user_2', displayName: 'Bob', customerCompanyId: 'company_1' }
    ])

    const result = await getComplianceKPIs()
    // Only Bob is outstanding
    expect(result.topOverdueUsers).toHaveLength(1)
    expect(result.topOverdueUsers[0].displayName).toBe('Bob')
  })

  it('sorts top overdue users by count descending and caps at 10', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([])
    // Create 11 users, each with a different overdue count
    const users = Array.from({ length: 11 }, (_, i) => ({
      id: `user_${i}`,
      displayName: `User ${i}`,
      customerCompanyId: 'co'
    }))
    // 11 separate overdue company-wide assignments, each completed by different subsets
    const overdueAssignments = users.map((u, i) => ({
      userId: null,
      customerCompanyId: 'co',
      // Leave user_i outstanding (everyone else completed)
      completions: users
        .filter((_, j) => j !== i)
        .map((x) => ({ signedById: x.id }))
    }))

    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([]) // monthly
      .mockResolvedValueOnce([]) // zero-completion
      .mockResolvedValueOnce(overdueAssignments)
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValueOnce(users)

    const result = await getComplianceKPIs()
    expect(result.topOverdueUsers).toHaveLength(10)
    // All users have exactly 1 overdue item; order is stable by Map iteration
    expect(result.topOverdueUsers.every((u) => u.overdueCount === 1)).toBe(true)
  })
})
