import prisma from './prisma'
import { resolveEmailRecipients } from './user-database'

export interface ReminderRecipient {
  email: string
  name: string
}

export interface ReminderTarget {
  assignment: {
    id: string
    templateTitle: string
    dueDate: string
    isOverdue: boolean
  }
  recipients: ReminderRecipient[]
}

// Reminder days relative to due date: 3 before, 1 before, day of, then weekly
export function isReminderDay(dueDate: Date, today: Date): boolean {
  const dueDayMs = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate()
  )
  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  const daysUntilDue = Math.round((dueDayMs - todayMs) / 86_400_000)
  if (daysUntilDue === 3 || daysUntilDue === 1 || daysUntilDue === 0)
    return true
  // Weekly overdue: -7, -14, -21, …
  if (daysUntilDue < 0 && daysUntilDue % 7 === 0) return true
  return false
}

export async function getAssignmentsNeedingReminders(
  today: Date
): Promise<ReminderTarget[]> {
  const assignments = await prisma.assignment.findMany({
    where: { dueDate: { not: null } },
    include: { template: { select: { title: true } } }
  })

  const due = assignments.filter((a) => isReminderDay(a.dueDate as Date, today))

  const results: ReminderTarget[] = []

  for (const assignment of due) {
    const dueDate = assignment.dueDate as Date

    const completedUserIds = new Set(
      (
        await prisma.completionRecord.findMany({
          where: { assignmentId: assignment.id },
          select: { signedById: true }
        })
      ).map((r) => r.signedById)
    )

    const targetJobRoles = Array.isArray(assignment.targetJobRoles)
      ? (assignment.targetJobRoles as string[])
      : null

    let candidates: {
      id: string
      email: string | null
      displayName: string
      jobRole: string | null
      lineManagerId: string | null
    }[]

    if (assignment.userId) {
      const user = await prisma.user.findUnique({
        where: { id: assignment.userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          jobRole: true,
          lineManagerId: true
        }
      })
      candidates = user ? [user] : []
    } else {
      candidates = await prisma.user.findMany({
        where: { customerCompanyId: assignment.customerCompanyId },
        select: {
          id: true,
          email: true,
          displayName: true,
          jobRole: true,
          lineManagerId: true
        }
      })
    }

    const outstanding = candidates.filter((u) => {
      if (completedUserIds.has(u.id)) return false
      if (assignment.userId) return true
      if (!targetJobRoles || targetJobRoles.length === 0) return true
      if (!u.jobRole) return true
      return targetJobRoles.includes(u.jobRole)
    })

    if (outstanding.length === 0) continue

    // Route no-email users to their line manager; deduplicate by email
    const recipients = await resolveEmailRecipients(
      outstanding.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        passwordHash: null,
        role: '',
        jobRole: u.jobRole,
        lineManagerId: u.lineManagerId,
        createdAt: '',
        customerCompanyId: null
      }))
    )

    if (recipients.length === 0) continue

    results.push({
      assignment: {
        id: assignment.id,
        templateTitle: assignment.template.title,
        dueDate: dueDate.toISOString(),
        isOverdue: dueDate < today
      },
      recipients
    })
  }

  return results
}
