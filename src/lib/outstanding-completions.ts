import prisma from './prisma'

export interface OutstandingCompletionRow {
  assignmentId: string
  company: { id: string; name: string }
  template: { id: string; title: string }
  templateVersion: number
  assignedTo: string
  assignedUserId: string | null
  assignedUserJobRole: string | null
  targetJobRoles: string[] | null
  dueDate: string | null
  daysOverdue: number | null
  isOverdue: boolean
  lastReminderSentAt: string | null
  outstandingCount: number
}

type PrismaOutstandingAssignment = {
  id: string
  userId: string | null
  dueDate: Date | null
  targetJobRoles: unknown
  templateVersion: number
  customerCompanyId: string
  lastReminderSentAt: Date | null
  template: { id: string; title: string }
  customerCompany: { id: string; name: string }
  user: { id: string; displayName: string; jobRole: string | null } | null
  _count: { completions: number }
}

export async function getOutstandingCompletions(): Promise<
  OutstandingCompletionRow[]
> {
  try {
    const now = new Date()

    const [assignments, companyUserCounts] = await Promise.all([
      prisma.assignment.findMany({
        include: {
          template: { select: { id: true, title: true } },
          customerCompany: { select: { id: true, name: true } },
          user: { select: { id: true, displayName: true, jobRole: true } },
          _count: { select: { completions: true } }
        }
      }),
      prisma.user.groupBy({
        by: ['customerCompanyId'],
        where: { customerCompanyId: { not: null } },
        _count: { id: true }
      })
    ])

    const companyUserCountMap = new Map(
      companyUserCounts.map((c) => [c.customerCompanyId!, c._count.id])
    )

    const rows: OutstandingCompletionRow[] = []

    for (const a of assignments as PrismaOutstandingAssignment[]) {
      const expectedCount = a.userId
        ? 1
        : (companyUserCountMap.get(a.customerCompanyId) ?? 0)
      const outstandingCount = Math.max(0, expectedCount - a._count.completions)
      if (outstandingCount === 0) continue

      const targetJobRoles = Array.isArray(a.targetJobRoles)
        ? (a.targetJobRoles as string[])
        : null

      const assignedTo = a.user
        ? a.user.displayName
        : targetJobRoles && targetJobRoles.length > 0
          ? targetJobRoles.join(', ')
          : 'All staff'

      const daysOverdue =
        a.dueDate && a.dueDate < now
          ? Math.floor((now.getTime() - a.dueDate.getTime()) / 86_400_000)
          : null

      rows.push({
        assignmentId: a.id,
        company: a.customerCompany,
        template: a.template,
        templateVersion: a.templateVersion,
        assignedTo,
        assignedUserId: a.userId,
        assignedUserJobRole: a.user?.jobRole ?? null,
        targetJobRoles,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        daysOverdue,
        isOverdue: daysOverdue !== null,
        lastReminderSentAt: a.lastReminderSentAt
          ? a.lastReminderSentAt.toISOString()
          : null,
        outstandingCount
      })
    }

    return rows.sort((a, b) => {
      if (a.dueDate === null && b.dueDate === null) return 0
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
  } catch (error) {
    console.error('Error getting outstanding completions:', error)
    return []
  }
}
