import prisma from './prisma'

export interface CompanyCompletionRate {
  companyName: string
  rate: number
  completedAssignments: number
  totalAssignments: number
}

export interface MonthlyThroughput {
  month: string
  assignments: number
  completions: number
}

export interface TemplateAvgDays {
  templateTitle: string
  avgDays: number
  completionCount: number
}

export interface CoverageGap {
  companyName: string
  templateTitle: string
}

export interface OverdueUser {
  displayName: string
  overdueCount: number
}

export interface ComplianceKPIs {
  companyCompletionRates: CompanyCompletionRate[]
  monthlyThroughput: MonthlyThroughput[]
  templateAvgDays: TemplateAvgDays[]
  companiesWithNoRecentCompletions: { id: string; name: string }[]
  coverageGaps: CoverageGap[]
  topOverdueUsers: OverdueUser[]
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function getComplianceKPIs(): Promise<ComplianceKPIs> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    companiesRaw,
    assignmentsByMonth,
    completionsByMonth,
    completionsForAvg,
    noRecentCompletionsRaw,
    zeroCompletionAssignments,
    overdueAssignments
  ] = await Promise.all([
    // 1. All companies that have at least one assignment
    prisma.customerCompany.findMany({
      where: { assignments: { some: {} } },
      select: {
        name: true,
        assignments: {
          select: { _count: { select: { completions: true } } }
        }
      },
      orderBy: { name: 'asc' }
    }),

    // 2a. Assignments created in the last 12 months
    prisma.assignment.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true }
    }),

    // 2b. Completions signed in the last 12 months
    prisma.completionRecord.findMany({
      where: { signedAt: { gte: twelveMonthsAgo } },
      select: { signedAt: true }
    }),

    // 3. All completions with assignment.createdAt for avg-days computation
    prisma.completionRecord.findMany({
      select: {
        signedAt: true,
        assignment: {
          select: {
            createdAt: true,
            template: { select: { title: true } }
          }
        }
      }
    }),

    // 4. Companies with assignments but no completions in the last 30 days
    prisma.customerCompany.findMany({
      where: {
        assignments: { some: {} },
        NOT: {
          assignments: {
            some: {
              completions: { some: { signedAt: { gte: thirtyDaysAgo } } }
            }
          }
        }
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),

    // 5. Assignments with zero completions (coverage gaps) — cap at 20
    prisma.assignment.findMany({
      where: { completions: { none: {} } },
      select: {
        customerCompany: { select: { name: true } },
        template: { select: { title: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 20
    }),

    // 6. Overdue assignments (dueDate in the past)
    prisma.assignment.findMany({
      where: { dueDate: { lt: now } },
      select: {
        userId: true,
        customerCompanyId: true,
        completions: { select: { signedById: true } }
      }
    })
  ])

  // --- 1. Company completion rates ---
  const companyCompletionRates: CompanyCompletionRate[] = companiesRaw
    .map((c) => {
      const total = c.assignments.length
      const completed = c.assignments.filter(
        (a) => a._count.completions > 0
      ).length
      return {
        companyName: c.name,
        totalAssignments: total,
        completedAssignments: completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    })
    .sort((a, b) => a.rate - b.rate)

  // --- 2. Monthly throughput ---
  const monthBuckets = new Map<
    string,
    { assignments: number; completions: number }
  >()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthBuckets.set(toMonthKey(d), { assignments: 0, completions: 0 })
  }
  for (const a of assignmentsByMonth) {
    const b = monthBuckets.get(toMonthKey(a.createdAt))
    if (b) b.assignments++
  }
  for (const c of completionsByMonth) {
    const b = monthBuckets.get(toMonthKey(c.signedAt))
    if (b) b.completions++
  }
  const monthlyThroughput: MonthlyThroughput[] = Array.from(
    monthBuckets.entries()
  ).map(([month, counts]) => ({ month, ...counts }))

  // --- 3. Template avg days to completion ---
  const templateBuckets = new Map<
    string,
    { totalDays: number; count: number }
  >()
  for (const cr of completionsForAvg) {
    const title = cr.assignment.template.title
    const days =
      (cr.signedAt.getTime() - cr.assignment.createdAt.getTime()) /
      (1000 * 60 * 60 * 24)
    if (!templateBuckets.has(title)) {
      templateBuckets.set(title, { totalDays: 0, count: 0 })
    }
    const b = templateBuckets.get(title)!
    b.totalDays += days
    b.count++
  }
  const templateAvgDays: TemplateAvgDays[] = Array.from(
    templateBuckets.entries()
  )
    .map(([templateTitle, { totalDays, count }]) => ({
      templateTitle,
      avgDays: Math.round(totalDays / count),
      completionCount: count
    }))
    .sort((a, b) => b.avgDays - a.avgDays)

  // --- 5. Coverage gaps ---
  const coverageGaps: CoverageGap[] = zeroCompletionAssignments.map((a) => ({
    companyName: a.customerCompany.name,
    templateTitle: a.template.title
  }))

  // --- 6. Top overdue users ---
  const companyIds = [
    ...new Set(
      overdueAssignments
        .filter((a) => a.userId === null)
        .map((a) => a.customerCompanyId)
    )
  ]
  const individualIds = [
    ...new Set(
      overdueAssignments.filter((a) => a.userId !== null).map((a) => a.userId!)
    )
  ]

  const [companyUsersRaw, individualUsersRaw] = await Promise.all([
    companyIds.length > 0
      ? prisma.user.findMany({
          where: { customerCompanyId: { in: companyIds } },
          select: { id: true, displayName: true, customerCompanyId: true }
        })
      : Promise.resolve(
          [] as {
            id: string
            displayName: string
            customerCompanyId: string | null
          }[]
        ),
    individualIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: individualIds } },
          select: { id: true, displayName: true }
        })
      : Promise.resolve([] as { id: string; displayName: string }[])
  ])

  const companyUserMap = new Map<
    string,
    { id: string; displayName: string }[]
  >()
  for (const u of companyUsersRaw) {
    if (!u.customerCompanyId) continue
    if (!companyUserMap.has(u.customerCompanyId)) {
      companyUserMap.set(u.customerCompanyId, [])
    }
    companyUserMap.get(u.customerCompanyId)!.push(u)
  }
  const individualUserMap = new Map(individualUsersRaw.map((u) => [u.id, u]))

  const overdueByUser = new Map<
    string,
    { displayName: string; count: number }
  >()
  for (const a of overdueAssignments) {
    const completedIds = new Set(a.completions.map((c) => c.signedById))
    const outstanding = a.userId
      ? (() => {
          const u = individualUserMap.get(a.userId)
          return u && !completedIds.has(a.userId) ? [u] : []
        })()
      : (companyUserMap.get(a.customerCompanyId) ?? []).filter(
          (u) => !completedIds.has(u.id)
        )
    for (const u of outstanding) {
      if (!overdueByUser.has(u.id)) {
        overdueByUser.set(u.id, { displayName: u.displayName, count: 0 })
      }
      overdueByUser.get(u.id)!.count++
    }
  }

  const topOverdueUsers: OverdueUser[] = Array.from(overdueByUser.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ displayName, count }) => ({ displayName, overdueCount: count }))

  return {
    companyCompletionRates,
    monthlyThroughput,
    templateAvgDays,
    companiesWithNoRecentCompletions: noRecentCompletionsRaw,
    coverageGaps,
    topOverdueUsers
  }
}
