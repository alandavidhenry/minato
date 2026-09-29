import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockGetUserById, mockGetAllUsers, mockResolve } =
  vi.hoisted(() => ({
    mockPrisma: {
      documentTemplate: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn()
      },
      templateReview: { create: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn()
    },
    mockGetUserById: vi.fn(),
    mockGetAllUsers: vi.fn(),
    mockResolve: vi.fn()
  }))
vi.mock('../prisma', () => ({ default: mockPrisma }))
vi.mock('../user-database', () => ({
  getUserById: mockGetUserById,
  getAllUsers: mockGetAllUsers,
  resolveEmailRecipients: mockResolve
}))

import {
  getTemplateReviews,
  getTemplatesDueForReview,
  getTemplatesNeedingReviewReminders,
  markTemplateReviewed
} from '../template-reviews'

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('markTemplateReviewed', () => {
  it('returns null when the template does not exist', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(null)
    expect(await markTemplateReviewed('x', {})).toBeNull()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('logs a review and restarts the clock without bumping the version', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue({
      id: 't1',
      version: 3
    })
    mockPrisma.templateReview.create.mockReturnValue('create-op')
    mockPrisma.documentTemplate.update.mockReturnValue('update-op')
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'r1',
        templateId: 't1',
        version: 3,
        reviewedAt: new Date('2026-09-30T09:00:00Z'),
        reviewedBy: 'u1',
        note: 'ok'
      },
      {
        id: 't1',
        version: 3,
        reviewDueAt: new Date('2027-09-30T09:00:00Z'),
        lastReviewedAt: new Date('2026-09-30T09:00:00Z')
      }
    ])

    const result = await markTemplateReviewed('t1', {
      reviewedBy: 'u1',
      note: 'ok'
    })

    expect(mockPrisma.templateReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: 't1',
        version: 3,
        reviewedBy: 'u1',
        note: 'ok'
      })
    })
    const updateArgs = mockPrisma.documentTemplate.update.mock.calls[0][0]
    expect(updateArgs.data).not.toHaveProperty('version')
    expect(updateArgs.data.lastReviewReminderAt).toBeNull()
    expect(updateArgs.data.reviewDueAt.toISOString()).toBe(
      '2027-09-30T09:00:00.000Z'
    )
    expect(result?.template.version).toBe(3)
    expect(result?.review.note).toBe('ok')
  })

  it('restarts the clock using the template review period', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue({
      id: 't1',
      version: 1,
      reviewPeriodMonths: 6
    })
    mockPrisma.$transaction.mockResolvedValue([
      {
        id: 'r1',
        templateId: 't1',
        version: 1,
        reviewedAt: new Date(),
        reviewedBy: null,
        note: null
      },
      { id: 't1', version: 1, reviewDueAt: null, lastReviewedAt: null }
    ])
    await markTemplateReviewed('t1', {})
    const data = mockPrisma.documentTemplate.update.mock.calls[0][0].data
    expect(data.reviewDueAt.toISOString()).toBe('2027-03-30T09:00:00.000Z')
  })

  it('returns null on a database error', async () => {
    mockPrisma.documentTemplate.findUnique.mockRejectedValue(new Error('x'))
    expect(await markTemplateReviewed('t1', {})).toBeNull()
  })
})

describe('getTemplateReviews', () => {
  it('maps rows and returns [] on error', async () => {
    mockPrisma.templateReview.findMany.mockResolvedValue([
      {
        id: 'r1',
        templateId: 't1',
        version: 1,
        reviewedAt: new Date('2026-01-01T00:00:00Z'),
        reviewedBy: null,
        note: null
      }
    ])
    expect((await getTemplateReviews('t1'))[0].reviewedAt).toBe(
      '2026-01-01T00:00:00.000Z'
    )
    mockPrisma.templateReview.findMany.mockRejectedValue(new Error('x'))
    expect(await getTemplateReviews('t1')).toEqual([])
  })
})

describe('getTemplatesDueForReview', () => {
  it('scopes to the tenant library and labels overdue vs due-soon', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'A',
        version: 1,
        reviewDueAt: new Date('2026-09-01T00:00:00Z'),
        reviewOwnerId: null
      },
      {
        id: 'b',
        title: 'B',
        version: 2,
        reviewDueAt: new Date('2026-10-15T00:00:00Z'),
        reviewOwnerId: 'u1'
      }
    ])
    const result = await getTemplatesDueForReview()
    expect(
      mockPrisma.documentTemplate.findMany.mock.calls[0][0].where
    ).toMatchObject({ ownerCompanyId: null })
    expect(result.map((r) => [r.id, r.status])).toEqual([
      ['a', 'overdue'],
      ['b', 'due-soon']
    ])
  })
})

describe('getTemplatesDueForReview scoping', () => {
  it('can be scoped to a single company', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([])
    await getTemplatesDueForReview(new Date(), 'co_1')
    expect(
      mockPrisma.documentTemplate.findMany.mock.calls[0][0].where
    ).toMatchObject({ ownerCompanyId: 'co_1' })
  })
})

describe('getTemplatesNeedingReviewReminders', () => {
  const owner = { id: 'u1', email: 's@h.com', displayName: 'Simon' }

  it('only targets templates on a 30/7/0-day mark', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'on',
        title: 'On',
        reviewDueAt: new Date('2026-10-07T00:00:00Z'),
        reviewOwnerId: 'u1',
        ownerCompanyId: null,
        lastReviewReminderAt: null
      },
      {
        id: 'off',
        title: 'Off',
        reviewDueAt: new Date('2026-11-08T00:00:00Z'),
        reviewOwnerId: 'u1',
        ownerCompanyId: null,
        lastReviewReminderAt: null
      }
    ])
    mockGetUserById.mockResolvedValue(owner)
    mockResolve.mockResolvedValue([{ email: 's@h.com', name: 'Simon' }])

    const targets = await getTemplatesNeedingReviewReminders(new Date())
    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      templateId: 'on',
      recipients: [{ email: 's@h.com', name: 'Simon' }]
    })
  })

  it('skips a milestone that was already sent', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'sent',
        title: 'Sent',
        reviewDueAt: new Date('2026-10-07T00:00:00Z'),
        reviewOwnerId: 'u1',
        ownerCompanyId: null,
        lastReviewReminderAt: new Date('2026-09-30T08:00:00Z')
      }
    ])
    expect(await getTemplatesNeedingReviewReminders(new Date())).toEqual([])
  })

  it('falls back to all admins for an ownerless tenant template', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'A',
        reviewDueAt: new Date('2026-09-30T00:00:00Z'),
        reviewOwnerId: null,
        ownerCompanyId: null,
        lastReviewReminderAt: null
      }
    ])
    mockGetAllUsers.mockResolvedValue([
      { id: 'u1', role: 'Tenant Admin' },
      { id: 'u2', role: 'Customer User' }
    ])
    mockResolve.mockResolvedValue([{ email: 's@h.com', name: 'Simon' }])

    const targets = await getTemplatesNeedingReviewReminders(new Date())
    expect(mockResolve).toHaveBeenCalledWith([
      { id: 'u1', role: 'Tenant Admin' }
    ])
    expect(targets).toHaveLength(1)
  })

  it('does not fall back to admins for an ownerless company template', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'A',
        reviewDueAt: new Date('2026-09-30T00:00:00Z'),
        reviewOwnerId: null,
        ownerCompanyId: 'co1',
        lastReviewReminderAt: null
      }
    ])
    expect(await getTemplatesNeedingReviewReminders(new Date())).toEqual([])
    expect(mockGetAllUsers).not.toHaveBeenCalled()
  })

  it('skips templates whose owner is missing or has no recipients', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'A',
        reviewDueAt: new Date('2026-09-30T00:00:00Z'),
        reviewOwnerId: 'gone',
        ownerCompanyId: 'co1',
        lastReviewReminderAt: null
      },
      {
        id: 'b',
        title: 'B',
        reviewDueAt: new Date('2026-09-30T00:00:00Z'),
        reviewOwnerId: 'u1',
        ownerCompanyId: null,
        lastReviewReminderAt: null
      }
    ])
    mockGetUserById.mockResolvedValueOnce(null).mockResolvedValueOnce(owner)
    mockResolve.mockResolvedValue([])
    expect(await getTemplatesNeedingReviewReminders(new Date())).toEqual([])
  })
})
