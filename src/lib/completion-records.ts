import prisma from './prisma'

export interface CompletionRecordData {
  id: string
  assignmentId: string
  signedById: string
  signedAt: string
  blobPath: string | null
  formData: unknown
}

export interface CompletionRecordWithTemplate extends CompletionRecordData {
  assignment: {
    id: string
    templateId: string
    template: {
      id: string
      title: string
      description: string | null
    }
  }
}

export interface CompletionRecordForAdmin {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string | null }
  assignment: {
    id: string
    template: { id: string; title: string }
    customerCompany: { id: string; name: string }
  }
}

type PrismaCompletionRecord = {
  id: string
  assignmentId: string
  signedById: string
  signedAt: Date
  blobPath: string | null
  formData: unknown
}

type PrismaCompletionRecordWithTemplate = PrismaCompletionRecord & {
  assignment: {
    id: string
    templateId: string
    template: {
      id: string
      title: string
      description: string | null
    }
  }
}

type PrismaCompletionRecordForAdmin = {
  id: string
  signedAt: Date
  blobPath: string | null
  signedBy: { id: string; displayName: string; email: string | null }
  assignment: {
    id: string
    template: { id: string; title: string }
    customerCompany: { id: string; name: string }
  }
}

function toCompletionRecordData(
  record: PrismaCompletionRecord
): CompletionRecordData {
  return {
    id: record.id,
    assignmentId: record.assignmentId,
    signedById: record.signedById,
    signedAt: record.signedAt.toISOString(),
    blobPath: record.blobPath,
    formData: record.formData
  }
}

function toCompletionRecordWithTemplate(
  record: PrismaCompletionRecordWithTemplate
): CompletionRecordWithTemplate {
  return {
    ...toCompletionRecordData(record),
    assignment: record.assignment
  }
}

function toCompletionRecordForAdmin(
  record: PrismaCompletionRecordForAdmin
): CompletionRecordForAdmin {
  return {
    id: record.id,
    signedAt: record.signedAt.toISOString(),
    blobPath: record.blobPath,
    signer: record.signedBy,
    assignment: record.assignment
  }
}

export async function createCompletionRecord({
  assignmentId,
  signedById,
  formData
}: {
  assignmentId: string
  signedById: string
  formData?: unknown
}): Promise<CompletionRecordData | null> {
  try {
    const record = await prisma.completionRecord.create({
      data: {
        assignmentId,
        signedById,
        formData: formData ?? undefined
      }
    })
    return toCompletionRecordData(record)
  } catch (error) {
    console.error('Error creating completion record:', error)
    return null
  }
}

export async function updateCompletionBlobPath(
  id: string,
  blobPath: string
): Promise<boolean> {
  try {
    await prisma.completionRecord.update({
      where: { id },
      data: { blobPath }
    })
    return true
  } catch (error) {
    console.error('Error updating completion blob path:', error)
    return false
  }
}

export async function getCompletionById(
  id: string
): Promise<CompletionRecordData | null> {
  try {
    const record = await prisma.completionRecord.findUnique({ where: { id } })
    if (!record) return null
    return toCompletionRecordData(record)
  } catch (error) {
    console.error('Error getting completion record:', error)
    return null
  }
}

export interface CompanyWithCompletionCount {
  id: string
  name: string
  completionCount: number
}

export interface CompletionGroupForAdmin {
  assignmentId: string
  template: { id: string; title: string }
  templateVersion: number
  completionCount: number
  lastCompletedAt: string | null
  dueDate: string | null
  isOverdue: boolean
  outstandingCount: number
}

export interface AssignmentStatusSummary {
  templateTitle: string
  dueDate: string | null
  isOverdue: boolean
  completedRecords: CompletionRecordForAssignment[]
  outstandingUsers: { id: string; displayName: string; email: string | null }[]
}

export interface CompletionRecordForAssignment {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string }
}

type PrismaAssignmentWithCompletionGroup = {
  id: string
  userId: string | null
  dueDate: Date | null
  templateVersion: number
  template: { id: string; title: string }
  _count: { completions: number }
  completions: { signedAt: Date }[]
}

type PrismaCompletionRecordForAssignment = {
  id: string
  signedAt: Date
  blobPath: string | null
  signedBy: { id: string; displayName: string; email: string }
}

export async function getCompaniesWithCompletions(): Promise<
  CompanyWithCompletionCount[]
> {
  try {
    const companies = await prisma.customerCompany.findMany({
      where: {
        assignments: { some: { completions: { some: {} } } }
      },
      include: {
        assignments: {
          where: { completions: { some: {} } },
          include: { _count: { select: { completions: true } } }
        }
      },
      orderBy: { name: 'asc' }
    })
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      completionCount: c.assignments.reduce(
        (sum, a) => sum + a._count.completions,
        0
      )
    }))
  } catch (error) {
    console.error('Error getting companies with completions:', error)
    return []
  }
}

export async function getCompletionGroupsByCompany(
  companyId: string
): Promise<CompletionGroupForAdmin[]> {
  try {
    const [assignments, companyUserCount] = await Promise.all([
      prisma.assignment.findMany({
        where: { customerCompanyId: companyId },
        include: {
          template: { select: { id: true, title: true } },
          completions: {
            select: { signedAt: true },
            orderBy: { signedAt: 'desc' },
            take: 1
          },
          _count: { select: { completions: true } }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.user.count({ where: { customerCompanyId: companyId } })
    ])

    const now = new Date()
    return (assignments as PrismaAssignmentWithCompletionGroup[]).map((a) => {
      const completionCount = a._count.completions
      const expectedCount = a.userId ? 1 : companyUserCount
      const outstandingCount = Math.max(0, expectedCount - completionCount)
      const isOverdue = !!(a.dueDate && a.dueDate < now && outstandingCount > 0)
      return {
        assignmentId: a.id,
        template: a.template,
        templateVersion: a.templateVersion,
        completionCount,
        lastCompletedAt: a.completions[0]?.signedAt.toISOString() ?? null,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        isOverdue,
        outstandingCount
      }
    })
  } catch (error) {
    console.error('Error getting completion groups by company:', error)
    return []
  }
}

export async function getCompletionsForAssignmentForAdmin(
  assignmentId: string
): Promise<CompletionRecordForAssignment[]> {
  try {
    const records = (await prisma.completionRecord.findMany({
      where: { assignmentId },
      include: {
        signedBy: { select: { id: true, displayName: true, email: true } }
      },
      orderBy: { signedAt: 'desc' }
    })) as PrismaCompletionRecordForAssignment[]
    return records.map((r) => ({
      id: r.id,
      signedAt: r.signedAt.toISOString(),
      blobPath: r.blobPath,
      signer: r.signedBy
    }))
  } catch (error) {
    console.error('Error getting completions for assignment (admin):', error)
    return []
  }
}

export async function deleteCompletionRecord(id: string): Promise<boolean> {
  try {
    await prisma.completionRecord.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting completion record:', error)
    return false
  }
}

export async function getCompletionsForAssignment(
  assignmentId: string
): Promise<CompletionRecordData[]> {
  try {
    const records = await prisma.completionRecord.findMany({
      where: { assignmentId },
      orderBy: { signedAt: 'desc' }
    })
    return records.map(toCompletionRecordData)
  } catch (error) {
    console.error('Error getting completions for assignment:', error)
    return []
  }
}

export async function getAssignmentStatusSummary(
  assignmentId: string
): Promise<AssignmentStatusSummary | null> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        userId: true,
        customerCompanyId: true,
        dueDate: true,
        template: { select: { title: true } }
      }
    })
    if (!assignment) return null

    const completionRecords = (await prisma.completionRecord.findMany({
      where: { assignmentId },
      include: {
        signedBy: { select: { id: true, displayName: true, email: true } }
      },
      orderBy: { signedAt: 'desc' }
    })) as PrismaCompletionRecordForAssignment[]

    const completedUserIds = new Set(
      completionRecords.map((r) => r.signedBy.id)
    )

    let expectedUsers: {
      id: string
      displayName: string
      email: string | null
    }[]
    if (assignment.userId) {
      const user = await prisma.user.findUnique({
        where: { id: assignment.userId },
        select: { id: true, displayName: true, email: true }
      })
      expectedUsers = user ? [user] : []
    } else {
      expectedUsers = await prisma.user.findMany({
        where: { customerCompanyId: assignment.customerCompanyId },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: 'asc' }
      })
    }

    const outstandingUsers = expectedUsers.filter(
      (u) => !completedUserIds.has(u.id)
    )
    const isOverdue = !!(
      assignment.dueDate &&
      assignment.dueDate < new Date() &&
      outstandingUsers.length > 0
    )

    return {
      templateTitle: assignment.template.title,
      dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
      isOverdue,
      completedRecords: completionRecords.map((r) => ({
        id: r.id,
        signedAt: r.signedAt.toISOString(),
        blobPath: r.blobPath,
        signer: r.signedBy
      })),
      outstandingUsers
    }
  } catch (error) {
    console.error('Error getting assignment status summary:', error)
    return null
  }
}

export async function getCompletionsForUser(
  signedById: string
): Promise<CompletionRecordWithTemplate[]> {
  try {
    const records = await prisma.completionRecord.findMany({
      where: { signedById },
      include: {
        assignment: {
          select: {
            id: true,
            templateId: true,
            template: { select: { id: true, title: true, description: true } }
          }
        }
      },
      orderBy: { signedAt: 'desc' }
    })
    return records.map(toCompletionRecordWithTemplate)
  } catch (error) {
    console.error('Error getting completions for user:', error)
    return []
  }
}

export async function getRecentCompletionsForAdmin(
  limit = 5
): Promise<CompletionRecordForAdmin[]> {
  try {
    const records = await prisma.completionRecord.findMany({
      take: limit,
      include: {
        signedBy: { select: { id: true, displayName: true, email: true } },
        assignment: {
          include: {
            template: { select: { id: true, title: true } },
            customerCompany: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { signedAt: 'desc' }
    })
    return records.map(toCompletionRecordForAdmin)
  } catch (error) {
    console.error('Error getting recent completions for admin:', error)
    return []
  }
}

export async function getAllCompletionsForAdmin(): Promise<
  CompletionRecordForAdmin[]
> {
  try {
    const records = await prisma.completionRecord.findMany({
      include: {
        signedBy: { select: { id: true, displayName: true, email: true } },
        assignment: {
          include: {
            template: { select: { id: true, title: true } },
            customerCompany: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { signedAt: 'desc' }
    })
    return records.map(toCompletionRecordForAdmin)
  } catch (error) {
    console.error('Error getting all completions:', error)
    return []
  }
}
