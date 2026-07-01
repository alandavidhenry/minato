import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as cronReminders } from '../cron/reminders/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockGetAssignmentsNeedingReminders } = vi.hoisted(() => ({
  mockGetAssignmentsNeedingReminders: vi.fn()
}))
vi.mock('@/lib/reminders', () => ({
  getAssignmentsNeedingReminders: mockGetAssignmentsNeedingReminders
}))

const { mockSendReminderNotification } = vi.hoisted(() => ({
  mockSendReminderNotification: vi.fn()
}))
vi.mock('@/lib/email', () => ({
  sendReminderNotification: mockSendReminderNotification
}))

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    assignment: { updateMany: vi.fn() }
  }
}))
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/reminders', {
    headers: authHeader ? { authorization: authHeader } : {}
  })
}

const TARGET = {
  assignment: {
    id: 'assignment_1',
    templateTitle: 'Farmyard Safety',
    dueDate: '2026-06-10T00:00:00.000Z',
    isOverdue: false
  },
  recipients: [{ email: 'alice@co.com', name: 'Alice' }]
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  process.env.NEXTAUTH_URL = 'https://portal.example.com'
  mockGetAssignmentsNeedingReminders.mockResolvedValue([])
  mockSendReminderNotification.mockResolvedValue(undefined)
  mockPrisma.assignment.updateMany.mockResolvedValue({ count: 0 })
})

// ---------------------------------------------------------------------------
// GET /api/cron/reminders
// ---------------------------------------------------------------------------

describe('GET /api/cron/reminders', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await cronReminders(getRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret is wrong', async () => {
    const res = await cronReminders(getRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET
    const res = await cronReminders(getRequest('Bearer test-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with sent count of 0 when no reminders needed', async () => {
    const res = await cronReminders(getRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(mockPrisma.assignment.updateMany).not.toHaveBeenCalled()
  })

  it('sends reminders and returns correct sent count', async () => {
    mockGetAssignmentsNeedingReminders.mockResolvedValue([TARGET])
    const res = await cronReminders(getRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(1)
    expect(mockSendReminderNotification).toHaveBeenCalledWith(
      [{ email: 'alice@co.com', name: 'Alice' }],
      'Farmyard Safety',
      '2026-06-10T00:00:00.000Z',
      false,
      'https://portal.example.com'
    )
    expect(mockPrisma.assignment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['assignment_1'] } },
      data: { lastReminderSentAt: expect.any(Date) }
    })
  })

  it('counts recipients across multiple targets', async () => {
    const target2 = {
      ...TARGET,
      assignment: { ...TARGET.assignment, id: 'assignment_2' },
      recipients: [
        { email: 'bob@co.com', name: 'Bob' },
        { email: 'carol@co.com', name: 'Carol' }
      ]
    }
    mockGetAssignmentsNeedingReminders.mockResolvedValue([TARGET, target2])
    const res = await cronReminders(getRequest('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect((await res.json()).sent).toBe(3)
  })

  it('returns 500 when reminder fetch throws', async () => {
    mockGetAssignmentsNeedingReminders.mockRejectedValue(new Error('DB error'))
    const res = await cronReminders(getRequest('Bearer test-secret'))
    expect(res.status).toBe(500)
  })
})
