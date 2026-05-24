import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAssignmentsNeedingReminders, isReminderDay } from '../reminders'

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    assignment: { findMany: vi.fn() },
    completionRecord: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() }
  }
}))
vi.mock('../prisma', () => ({ default: mockPrisma }))

// resolveEmailRecipients calls getUserById which calls prisma.user.findUnique.
// We mock user-database so resolveEmailRecipients just returns the email from
// each user's email field (or the manager's email for no-email users).
const { mockResolveEmailRecipients } = vi.hoisted(() => ({
  mockResolveEmailRecipients: vi.fn()
}))
vi.mock('../user-database', () => ({
  resolveEmailRecipients: mockResolveEmailRecipients,
  getUserById: vi.fn()
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DUE_DATE = new Date('2026-06-10T00:00:00.000Z')

const BASE_ASSIGNMENT = {
  id: 'assignment_1',
  templateId: 'template_1',
  customerCompanyId: 'company_1',
  userId: null,
  dueDate: DUE_DATE,
  targetJobRoles: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  template: { title: 'Farmyard Safety Checklist' }
}

const BASE_USER = {
  id: 'user_1',
  email: 'alice@co.com',
  displayName: 'Alice',
  jobRole: null,
  lineManagerId: null
}

const NO_EMAIL_USER = {
  id: 'user_2',
  email: null,
  displayName: 'Bob',
  jobRole: null,
  lineManagerId: 'manager_1'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.completionRecord.findMany.mockResolvedValue([])
  mockPrisma.user.findMany.mockResolvedValue([BASE_USER])
  mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
  // Default: pass through email users unchanged
  mockResolveEmailRecipients.mockImplementation((users: (typeof BASE_USER)[]) =>
    Promise.resolve(
      users
        .filter((u) => u.email)
        .map((u) => ({ email: u.email!, name: u.displayName }))
    )
  )
})

// ---------------------------------------------------------------------------
// isReminderDay
// ---------------------------------------------------------------------------

describe('isReminderDay', () => {
  it('returns true 3 days before due', () => {
    const today = new Date('2026-06-07T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(true)
  })

  it('returns true 1 day before due', () => {
    const today = new Date('2026-06-09T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(true)
  })

  it('returns true on the due date', () => {
    const today = new Date('2026-06-10T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(true)
  })

  it('returns false 2 days before due', () => {
    const today = new Date('2026-06-08T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(false)
  })

  it('returns false 4 days before due', () => {
    const today = new Date('2026-06-06T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(false)
  })

  it('returns false 1 day after due', () => {
    const today = new Date('2026-06-11T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(false)
  })

  it('returns true 7 days after due (first weekly overdue)', () => {
    const today = new Date('2026-06-17T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(true)
  })

  it('returns true 14 days after due (second weekly overdue)', () => {
    const today = new Date('2026-06-24T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(true)
  })

  it('returns false 8 days after due (not a weekly boundary)', () => {
    const today = new Date('2026-06-18T00:00:00.000Z')
    expect(isReminderDay(DUE_DATE, today)).toBe(false)
  })

  it('ignores time of day — matches due date regardless of time', () => {
    const dueWithTime = new Date('2026-06-10T23:59:59.000Z')
    const todayMidnight = new Date('2026-06-10T00:00:00.000Z')
    expect(isReminderDay(dueWithTime, todayMidnight)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getAssignmentsNeedingReminders
// ---------------------------------------------------------------------------

describe('getAssignmentsNeedingReminders', () => {
  it('returns empty array when no assignments have due dates', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([])
    const result = await getAssignmentsNeedingReminders(
      new Date('2026-06-10T00:00:00.000Z')
    )
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no assignments match reminder day', async () => {
    // 2 days before due — not a reminder day
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    const today = new Date('2026-06-08T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(0)
  })

  it('returns assignment with outstanding users on a reminder day', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    const today = new Date('2026-06-10T00:00:00.000Z') // due date
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(1)
    expect(result[0].assignment.templateTitle).toBe('Farmyard Safety Checklist')
    expect(result[0].recipients).toHaveLength(1)
    expect(result[0].recipients[0].email).toBe('alice@co.com')
  })

  it('excludes users who have already completed the assignment', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      { signedById: 'user_1' }
    ])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(0)
  })

  it('filters company-wide recipients by targetJobRoles', async () => {
    const assignmentWithRoles = {
      ...BASE_ASSIGNMENT,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany.mockResolvedValue([assignmentWithRoles])
    mockPrisma.user.findMany.mockResolvedValue([
      {
        ...BASE_USER,
        id: 'u1',
        email: 'mgr@co.com',
        displayName: 'Manager',
        jobRole: 'Site Manager'
      },
      {
        ...BASE_USER,
        id: 'u2',
        email: 'op@co.com',
        displayName: 'Operator',
        jobRole: 'Operator'
      }
    ])
    mockResolveEmailRecipients.mockResolvedValue([
      { email: 'mgr@co.com', name: 'Manager' }
    ])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result[0].recipients).toHaveLength(1)
    expect(result[0].recipients[0].email).toBe('mgr@co.com')
  })

  it('includes users with no job role when targetJobRoles is set', async () => {
    const assignmentWithRoles = {
      ...BASE_ASSIGNMENT,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany.mockResolvedValue([assignmentWithRoles])
    mockPrisma.user.findMany.mockResolvedValue([
      {
        ...BASE_USER,
        id: 'u1',
        email: 'mgr@co.com',
        displayName: 'Manager',
        jobRole: 'Site Manager'
      },
      {
        ...BASE_USER,
        id: 'u2',
        email: 'norole@co.com',
        displayName: 'No Role',
        jobRole: null
      }
    ])
    mockResolveEmailRecipients.mockResolvedValue([
      { email: 'mgr@co.com', name: 'Manager' },
      { email: 'norole@co.com', name: 'No Role' }
    ])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result[0].recipients).toHaveLength(2)
  })

  it('routes no-email workers to their line manager', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    mockPrisma.user.findMany.mockResolvedValue([NO_EMAIL_USER])
    mockResolveEmailRecipients.mockResolvedValue([
      { email: 'manager@co.com', name: 'Manager' }
    ])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(1)
    expect(result[0].recipients[0].email).toBe('manager@co.com')
  })

  it('skips assignments where all outstanding users have no email and no line manager', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    mockPrisma.user.findMany.mockResolvedValue([
      { ...NO_EMAIL_USER, lineManagerId: null }
    ])
    mockResolveEmailRecipients.mockResolvedValue([])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(0)
  })

  it('handles individual assignment — notifies only that user', async () => {
    const individualAssignment = { ...BASE_ASSIGNMENT, userId: 'user_1' }
    mockPrisma.assignment.findMany.mockResolvedValue([individualAssignment])
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_1' } })
    )
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
    expect(result[0].recipients).toHaveLength(1)
  })

  it('skips individual assignment when user is not found', async () => {
    const individualAssignment = { ...BASE_ASSIGNMENT, userId: 'user_ghost' }
    mockPrisma.assignment.findMany.mockResolvedValue([individualAssignment])
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const today = new Date('2026-06-10T00:00:00.000Z')
    const result = await getAssignmentsNeedingReminders(today)
    expect(result).toHaveLength(0)
  })

  it('marks assignment as overdue when past due date', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    const today = new Date('2026-06-17T00:00:00.000Z') // 7 days after due
    const result = await getAssignmentsNeedingReminders(today)
    expect(result[0].assignment.isOverdue).toBe(true)
  })

  it('marks assignment as not overdue when on or before due date', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([BASE_ASSIGNMENT])
    const today = new Date('2026-06-10T00:00:00.000Z') // due date
    const result = await getAssignmentsNeedingReminders(today)
    expect(result[0].assignment.isOverdue).toBe(false)
  })
})
