import prisma from './prisma'

export interface DashboardKPIs {
  activeAssignments: number
  completedThisMonth: number
  outstanding: number
  overdue: number
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    activeAssignments,
    completedThisMonth,
    assignmentsWithCounts,
    companyUserCounts
  ] = await Promise.all([
    prisma.assignment.count(),
    prisma.completionRecord.count({
      where: { signedAt: { gte: startOfMonth } }
    }),
    prisma.assignment.findMany({
      select: {
        id: true,
        userId: true,
        customerCompanyId: true,
        dueDate: true,
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

  let outstanding = 0
  let overdue = 0

  for (const a of assignmentsWithCounts) {
    const expectedCount =
      a.userId !== null
        ? 1
        : (companyUserCountMap.get(a.customerCompanyId) ?? 0)
    const outstandingCount = Math.max(0, expectedCount - a._count.completions)
    if (outstandingCount > 0) {
      outstanding++
      if (a.dueDate && a.dueDate < now) {
        overdue++
      }
    }
  }

  return { activeAssignments, completedThisMonth, outstanding, overdue }
}
