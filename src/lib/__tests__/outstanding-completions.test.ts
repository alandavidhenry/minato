import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getOutstandingCompletions } from '../outstanding-completions'

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    assignment: { findMany: vi.fn() },
    user: { groupBy: vi.fn() }
  }
  return { mockPrisma }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-15T12:00:00.000Z')

const COMPANY = { id: 'company_1', name: 'Acme Farms' }
const TEMPLATE = { id: 'template_1', title: 'Tractor Safety' }

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment_1',
    userId: null,
    dueDate: null,
    targetJobRoles: null,
    templateVersion: 1,
    customerCompanyId: COMPANY.id,
    lastReminderSentAt: null,
    template: TEMPLATE,
    customerCompany: COMPANY,
    user: null,
    _count: { completions: 0 },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(NOW)
  mockPrisma.assignment.findMany.mockResolvedValue([])
  mockPrisma.user.groupBy.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getOutstandingCompletions', () => {
  it('returns an empty array when there are no assignments', async () => {
    const result = await getOutstandingCompletions()
    expect(result).toEqual([])
  })

  it('excludes assignments with no outstanding users', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({ userId: 'user_1', _count: { completions: 1 } })
    ])
    const result = await getOutstandingCompletions()
    expect(result).toEqual([])
  })

  it('includes an individual assignment with no completion', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({
        userId: 'user_1',
        user: { id: 'user_1', displayName: 'Jane Smith', jobRole: 'Driver' }
      })
    ])
    const result = await getOutstandingCompletions()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      assignedTo: 'Jane Smith',
      assignedUserId: 'user_1',
      assignedUserJobRole: 'Driver',
      outstandingCount: 1
    })
  })

  it('computes outstanding count for company-wide assignments from company user count', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([makeAssignment()])
    mockPrisma.user.groupBy.mockResolvedValue([
      { customerCompanyId: COMPANY.id, _count: { id: 5 } }
    ])
    const result = await getOutstandingCompletions()
    expect(result).toHaveLength(1)
    expect(result[0].outstandingCount).toBe(5)
    expect(result[0].assignedTo).toBe('All staff')
  })

  it('labels company-wide assignments with their target job roles', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({ targetJobRoles: ['Driver', 'Operator'] })
    ])
    mockPrisma.user.groupBy.mockResolvedValue([
      { customerCompanyId: COMPANY.id, _count: { id: 3 } }
    ])
    const result = await getOutstandingCompletions()
    expect(result[0].assignedTo).toBe('Driver, Operator')
    expect(result[0].targetJobRoles).toEqual(['Driver', 'Operator'])
  })

  it('flags overdue assignments and computes days overdue', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({
        userId: 'user_1',
        user: { id: 'user_1', displayName: 'Jane Smith', jobRole: null },
        dueDate: new Date('2026-06-10T00:00:00.000Z')
      })
    ])
    const result = await getOutstandingCompletions()
    expect(result[0].isOverdue).toBe(true)
    expect(result[0].daysOverdue).toBe(5)
  })

  it('does not flag assignments with a future due date as overdue', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({
        userId: 'user_1',
        user: { id: 'user_1', displayName: 'Jane Smith', jobRole: null },
        dueDate: new Date('2026-07-01T00:00:00.000Z')
      })
    ])
    const result = await getOutstandingCompletions()
    expect(result[0].isOverdue).toBe(false)
    expect(result[0].daysOverdue).toBeNull()
  })

  it('surfaces lastReminderSentAt when set', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({
        userId: 'user_1',
        user: { id: 'user_1', displayName: 'Jane Smith', jobRole: null },
        lastReminderSentAt: new Date('2026-06-08T00:00:00.000Z')
      })
    ])
    const result = await getOutstandingCompletions()
    expect(result[0].lastReminderSentAt).toBe('2026-06-08T00:00:00.000Z')
  })

  it('sorts by due date ascending, with no-due-date assignments last', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      makeAssignment({
        id: 'no_due_date',
        userId: 'user_1',
        user: { id: 'user_1', displayName: 'No Due Date', jobRole: null },
        dueDate: null
      }),
      makeAssignment({
        id: 'later',
        userId: 'user_2',
        user: { id: 'user_2', displayName: 'Later', jobRole: null },
        dueDate: new Date('2026-07-01T00:00:00.000Z')
      }),
      makeAssignment({
        id: 'sooner',
        userId: 'user_3',
        user: { id: 'user_3', displayName: 'Sooner', jobRole: null },
        dueDate: new Date('2026-06-20T00:00:00.000Z')
      })
    ])
    const result = await getOutstandingCompletions()
    expect(result.map((r) => r.assignmentId)).toEqual([
      'sooner',
      'later',
      'no_due_date'
    ])
  })

  it('returns an empty array when the query throws', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('DB error'))
    const result = await getOutstandingCompletions()
    expect(result).toEqual([])
  })
})
