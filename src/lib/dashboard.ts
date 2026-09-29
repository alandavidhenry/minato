import prisma from './prisma'
import { REVIEW_DUE_SOON_DAYS } from './review-dates'

export interface DashboardKPIs {
  activeAssignments: number
  completedThisMonth: number
  completedThisWeek: number
  outstanding: number
  overdue: number
  templatesDueForReview: number
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diff
  )

  const [
    activeAssignments,
    completedThisMonth,
    completedThisWeek,
    assignmentsWithCounts,
    companyUserCounts,
    templatesDueForReview
  ] = await Promise.all([
    prisma.assignment.count(),
    prisma.completionRecord.count({
      where: { signedAt: { gte: startOfMonth } }
    }),
    prisma.completionRecord.count({
      where: { signedAt: { gte: startOfWeek } }
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
    }),
    // Tenant-library templates overdue for review or due within the soon window
    prisma.documentTemplate.count({
      where: {
        ownerCompanyId: null,
        reviewDueAt: {
          lte: new Date(now.getTime() + REVIEW_DUE_SOON_DAYS * 86_400_000)
        }
      }
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

  return {
    activeAssignments,
    completedThisMonth,
    completedThisWeek,
    outstanding,
    overdue,
    templatesDueForReview
  }
}
