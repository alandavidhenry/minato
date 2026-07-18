import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDashboardKPIs } from '../dashboard'

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    assignment: { count: vi.fn(), findMany: vi.fn() },
    completionRecord: { count: vi.fn() },
    user: { groupBy: vi.fn() }
  }
  return { mockPrisma }
})
vi.mock('../prisma', () => ({ default: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.assignment.count.mockResolvedValue(0)
  mockPrisma.completionRecord.count.mockResolvedValue(0)
  mockPrisma.assignment.findMany.mockResolvedValue([])
  mockPrisma.user.groupBy.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getDashboardKPIs', () => {
  it('returns zeroed KPIs when there is no data', async () => {
    const result = await getDashboardKPIs()
    expect(result).toEqual({
      activeAssignments: 0,
      completedThisMonth: 0,
      completedThisWeek: 0,
      outstanding: 0,
      overdue: 0
    })
  })

  it('queries completedThisMonth from the 1st of the current calendar month', async () => {
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))
    await getDashboardKPIs()
    expect(mockPrisma.completionRecord.count).toHaveBeenNthCalledWith(1, {
      where: { signedAt: { gte: new Date(2026, 6, 1) } }
    })
  })

  it('queries completedThisWeek from Monday of the current week on a mid-week day', async () => {
    // Saturday 2026-07-18
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))
    await getDashboardKPIs()
    expect(mockPrisma.completionRecord.count).toHaveBeenNthCalledWith(2, {
      where: { signedAt: { gte: new Date(2026, 6, 13) } }
    })
  })

  it('rolls back to the prior Monday when today is a Sunday', async () => {
    // Sunday 2026-07-19
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'))
    await getDashboardKPIs()
    expect(mockPrisma.completionRecord.count).toHaveBeenNthCalledWith(2, {
      where: { signedAt: { gte: new Date(2026, 6, 13) } }
    })
  })

  it('uses today as the week start when today is a Monday', async () => {
    // Monday 2026-07-20
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'))
    await getDashboardKPIs()
    expect(mockPrisma.completionRecord.count).toHaveBeenNthCalledWith(2, {
      where: { signedAt: { gte: new Date(2026, 6, 20) } }
    })
  })

  it('returns activeAssignments as a raw assignment count', async () => {
    mockPrisma.assignment.count.mockResolvedValue(42)
    const result = await getDashboardKPIs()
    expect(result.activeAssignments).toBe(42)
  })

  it('returns completedThisMonth and completedThisWeek from separate counts', async () => {
    mockPrisma.completionRecord.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(2)
    const result = await getDashboardKPIs()
    expect(result.completedThisMonth).toBe(9)
    expect(result.completedThisWeek).toBe(2)
  })

  it('computes outstanding and overdue from assignment completion counts', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    mockPrisma.assignment.findMany.mockResolvedValue([
      {
        id: 'a1',
        userId: 'user_1',
        customerCompanyId: 'company_1',
        dueDate: new Date('2026-06-10T00:00:00.000Z'),
        _count: { completions: 0 }
      },
      {
        id: 'a2',
        userId: 'user_2',
        customerCompanyId: 'company_1',
        dueDate: new Date('2026-07-01T00:00:00.000Z'),
        _count: { completions: 0 }
      },
      {
        id: 'a3',
        userId: 'user_3',
        customerCompanyId: 'company_1',
        dueDate: null,
        _count: { completions: 1 }
      }
    ])
    const result = await getDashboardKPIs()
    expect(result.outstanding).toBe(2)
    expect(result.overdue).toBe(1)
  })
})
