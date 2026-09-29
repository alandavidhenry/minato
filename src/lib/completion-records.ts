import type { UploadedFileValue } from '@/types/form-schema'

import {
  computeValidUntil,
  DEFAULT_RENEWAL_LEAD_DAYS,
  getValidityStatus,
  type ValidityStatus
} from './completion-validity'
import prisma from './prisma'
import { getRenewalLeadDaysForCompany } from './user-database'

export interface CompletionUploadedFile {
  fieldId: string
  fileName: string
}

// formData stores a `{ blobPath, fileName }` object at a file field's id —
// pick those out so admins can review/download what was actually uploaded,
// regardless of what the template's current formSchema looks like now.
function extractUploadedFiles(formData: unknown): CompletionUploadedFile[] {
  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return []
  }
  const files: CompletionUploadedFile[] = []
  for (const [fieldId, value] of Object.entries(
    formData as Record<string, unknown>
  )) {
    const candidate = value as Partial<UploadedFileValue> | undefined
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.blobPath === 'string' &&
      typeof candidate.fileName === 'string'
    ) {
      files.push({ fieldId, fileName: candidate.fileName })
    }
  }
  return files
}

export interface CompletionRecordData {
  id: string
  assignmentId: string
  signedById: string
  signedAt: string
  blobPath: string | null
  formData: unknown
  submittedBlobPath: string | null
  submittedOriginalBlobPath: string | null
  submittedFileName: string | null
  signerIp: string | null
  signerUserAgent: string | null
  validUntil: string | null
}

export interface CompletionRecordWithTemplate extends CompletionRecordData {
  validityStatus: ValidityStatus | null
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
  submittedBlobPath: string | null
  submittedOriginalBlobPath: string | null
  submittedFileName: string | null
  signerIp: string | null
  signerUserAgent: string | null
  validUntil: Date | null
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
    formData: record.formData,
    submittedBlobPath: record.submittedBlobPath,
    submittedOriginalBlobPath: record.submittedOriginalBlobPath,
    submittedFileName: record.submittedFileName,
    signerIp: record.signerIp,
    signerUserAgent: record.signerUserAgent,
    validUntil: record.validUntil ? record.validUntil.toISOString() : null
  }
}

function toCompletionRecordWithTemplate(
  record: PrismaCompletionRecordWithTemplate,
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): CompletionRecordWithTemplate {
  return {
    ...toCompletionRecordData(record),
    validityStatus: getValidityStatus(record.validUntil, new Date(), leadDays),
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
  formData,
  submittedBlobPath,
  submittedOriginalBlobPath,
  submittedFileName,
  signerIp,
  signerUserAgent
}: {
  assignmentId: string
  signedById: string
  formData?: unknown
  submittedBlobPath?: string
  submittedOriginalBlobPath?: string
  submittedFileName?: string
  signerIp?: string
  signerUserAgent?: string
}): Promise<CompletionRecordData | null> {
  try {
    // Recurring assignments: the completion expires recurrenceMonths after signing
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { recurrenceMonths: true }
    })
    const signedAt = new Date()
    const validUntil = assignment?.recurrenceMonths
      ? computeValidUntil(signedAt, assignment.recurrenceMonths)
      : null

    const record = await prisma.completionRecord.create({
      data: {
        assignmentId,
        signedById,
        signedAt,
        validUntil,
        formData: formData ?? undefined,
        submittedBlobPath,
        submittedOriginalBlobPath,
        submittedFileName,
        signerIp,
        signerUserAgent
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

// Records the employee's own filled-in copy for a fill-and-return upload
// template completion — the converted PDF and retained original.
export async function updateCompletionSubmission(
  id: string,
  submission: {
    submittedBlobPath: string
    submittedOriginalBlobPath: string
    submittedFileName: string
  }
): Promise<boolean> {
  try {
    await prisma.completionRecord.update({
      where: { id },
      data: submission
    })
    return true
  } catch (error) {
    console.error('Error updating completion submission:', error)
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
  templateId: string
  template: { id: string; title: string }
  templateVersion: number
  completionCount: number
  lastCompletedAt: string | null
  dueDate: string | null
  isOverdue: boolean
  outstandingCount: number
  // Recurring sign-offs: users whose latest completion lapses within
  // the tenant's renewal lead time / has already lapsed (expired users are also outstanding)
  expiringSoonCount: number
  expiredCount: number
}

export interface UserValiditySummary {
  validUserIds: Set<string>
  expiredUserIds: Set<string>
  expiringSoonUserIds: Set<string>
  // validUntil of each expired user's most recent completion
  expiredAt: Date[]
}

// A user is "valid" while any of their completions is unexpired (null validUntil
// never expires). Once every completion has lapsed they are "expired" and count
// as outstanding again.
export function summariseUserValidity(
  records: { signedById: string; validUntil: Date | null }[],
  now: Date,
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): UserValiditySummary {
  const bestByUser = new Map<string, number>()
  for (const r of records) {
    const value = r.validUntil ? r.validUntil.getTime() : Infinity
    const existing = bestByUser.get(r.signedById)
    if (existing === undefined || value > existing) {
      bestByUser.set(r.signedById, value)
    }
  }
  const summary: UserValiditySummary = {
    validUserIds: new Set(),
    expiredUserIds: new Set(),
    expiringSoonUserIds: new Set(),
    expiredAt: []
  }
  const soonMs = now.getTime() + leadDays * 86_400_000
  for (const [userId, best] of bestByUser) {
    if (best <= now.getTime()) {
      summary.expiredUserIds.add(userId)
      summary.expiredAt.push(new Date(best))
    } else {
      summary.validUserIds.add(userId)
      if (best <= soonMs) summary.expiringSoonUserIds.add(userId)
    }
  }
  return summary
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
  signerIp: string | null
  signerUserAgent: string | null
  validUntil: string | null
  validityStatus: ValidityStatus | null
  files: CompletionUploadedFile[]
}

type PrismaAssignmentWithCompletionGroup = {
  id: string
  userId: string | null
  dueDate: Date | null
  templateVersion: number
  template: { id: string; title: string }
  _count: { completions: number }
  completions: { signedAt: Date; signedById: string; validUntil: Date | null }[]
}

type PrismaCompletionRecordForAssignment = {
  id: string
  assignmentId: string
  signedAt: Date
  blobPath: string | null
  formData: unknown
  signedBy: { id: string; displayName: string; email: string }
  signerIp: string | null
  signerUserAgent: string | null
  validUntil: Date | null
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
            select: { signedAt: true, signedById: true, validUntil: true },
            orderBy: { signedAt: 'desc' }
          },
          _count: { select: { completions: true } }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.user.count({ where: { customerCompanyId: companyId } })
    ])
    const leadDays = await getRenewalLeadDaysForCompany(companyId)

    const now = new Date()

    // Group by template, keeping only the current (highest) version's
    // assignments — superseded versions can no longer be completed by
    // anyone (employees only ever see the latest version) so they'd
    // otherwise linger here as permanently "outstanding" clutter.
    const byTemplate = new Map<string, PrismaAssignmentWithCompletionGroup[]>()
    for (const a of assignments as PrismaAssignmentWithCompletionGroup[]) {
      const list = byTemplate.get(a.template.id) ?? []
      list.push(a)
      byTemplate.set(a.template.id, list)
    }

    const groups: CompletionGroupForAdmin[] = []
    for (const [templateId, all] of byTemplate) {
      const maxVersion = Math.max(...all.map((a) => a.templateVersion))
      const current = all.filter((a) => a.templateVersion === maxVersion)

      // Multiple assignments can target the same template+version at once
      // (a company-wide assignment plus individually auto-enrolled users) —
      // merge them into a single row rather than showing one per assignment.
      const completionCount = current.reduce(
        (sum, a) => sum + a._count.completions,
        0
      )
      const hasCompanyWide = current.some((a) => a.userId === null)
      // Individual renewal cycles share a user with their earlier cycle, so
      // expected users are counted per distinct user, not per assignment
      const expectedCount = hasCompanyWide
        ? companyUserCount
        : new Set(current.map((a) => a.userId)).size
      const validity = summariseUserValidity(
        current.flatMap((a) => a.completions),
        now,
        leadDays
      )
      const outstandingCount = Math.max(
        0,
        expectedCount - validity.validUserIds.size
      )

      // Assignments that are fully done no longer set the due date; a lapsed
      // completion counts as due on the day it expired
      const completedAssignmentIds = new Set(
        current.filter((a) => a.completions.length > 0).map((a) => a.id)
      )
      const dueDates = [
        ...current
          .filter((a) => a.userId === null || !completedAssignmentIds.has(a.id))
          .map((a) => a.dueDate)
          .filter((d): d is Date => d !== null),
        ...validity.expiredAt
      ]
      const dueDate =
        dueDates.length > 0
          ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
          : null
      const isOverdue = !!(dueDate && dueDate < now && outstandingCount > 0)

      const lastCompletedTimes = current
        .map((a) => a.completions[0]?.signedAt)
        .filter((d): d is Date => d !== undefined)
      const lastCompletedAt =
        lastCompletedTimes.length > 0
          ? new Date(
              Math.max(...lastCompletedTimes.map((d) => d.getTime()))
            ).toISOString()
          : null

      groups.push({
        templateId,
        template: current[0].template,
        templateVersion: maxVersion,
        completionCount,
        lastCompletedAt,
        dueDate: dueDate ? dueDate.toISOString() : null,
        isOverdue,
        outstandingCount,
        expiringSoonCount: validity.expiringSoonUserIds.size,
        expiredCount: validity.expiredUserIds.size
      })
    }

    return groups
  } catch (error) {
    console.error('Error getting completion groups by company:', error)
    return []
  }
}

export async function getTemplateCompletionSummaryForCompany(
  companyId: string,
  templateId: string
): Promise<AssignmentStatusSummary | null> {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { customerCompanyId: companyId, templateId },
      select: {
        id: true,
        userId: true,
        dueDate: true,
        templateVersion: true,
        template: { select: { title: true } }
      }
    })
    if (assignments.length === 0) return null

    const now = new Date()
    const leadDays = await getRenewalLeadDaysForCompany(companyId)

    const maxVersion = Math.max(...assignments.map((a) => a.templateVersion))
    const current = assignments.filter((a) => a.templateVersion === maxVersion)
    const assignmentIds = current.map((a) => a.id)

    const completionRecords = (await prisma.completionRecord.findMany({
      where: { assignmentId: { in: assignmentIds } },
      include: {
        signedBy: { select: { id: true, displayName: true, email: true } }
      },
      orderBy: { signedAt: 'desc' }
    })) as PrismaCompletionRecordForAssignment[]

    // Lapsed completions no longer count — the user is outstanding again
    const validity = summariseUserValidity(
      completionRecords.map((r) => ({
        signedById: r.signedBy.id,
        validUntil: r.validUntil
      })),
      now,
      leadDays
    )
    const completedUserIds = validity.validUserIds

    let expectedUsers: {
      id: string
      displayName: string
      email: string | null
    }[]
    const hasCompanyWide = current.some((a) => a.userId === null)
    if (hasCompanyWide) {
      expectedUsers = await prisma.user.findMany({
        where: { customerCompanyId: companyId },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: 'asc' }
      })
    } else {
      const userIds = current
        .map((a) => a.userId)
        .filter((id): id is string => id !== null)
      expectedUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: 'asc' }
      })
    }

    const outstandingUsers = expectedUsers.filter(
      (u) => !completedUserIds.has(u.id)
    )

    // Fully-completed individual assignments no longer set the due date; a
    // lapsed completion counts as due on the day it expired
    const completedAssignmentIds = new Set(
      completionRecords.map((r) => r.assignmentId)
    )
    const dueDates = [
      ...current
        .filter((a) => a.userId === null || !completedAssignmentIds.has(a.id))
        .map((a) => a.dueDate)
        .filter((d): d is Date => d !== null),
      ...validity.expiredAt
    ]
    const dueDate =
      dueDates.length > 0
        ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
        : null
    const isOverdue = !!(
      dueDate &&
      dueDate < now &&
      outstandingUsers.length > 0
    )

    return {
      templateTitle: current[0].template.title,
      dueDate: dueDate ? dueDate.toISOString() : null,
      isOverdue,
      completedRecords: completionRecords.map((r) => ({
        id: r.id,
        signedAt: r.signedAt.toISOString(),
        blobPath: r.blobPath,
        signer: r.signedBy,
        signerIp: r.signerIp,
        signerUserAgent: r.signerUserAgent,
        validUntil: r.validUntil ? r.validUntil.toISOString() : null,
        validityStatus: getValidityStatus(r.validUntil, now, leadDays),
        files: extractUploadedFiles(r.formData)
      })),
      outstandingUsers
    }
  } catch (error) {
    console.error('Error getting template completion summary:', error)
    return null
  }
}

export async function getCompletionsForAssignmentForAdmin(
  assignmentId: string
): Promise<CompletionRecordForAssignment[]> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { customerCompanyId: true }
    })
    const leadDays = await getRenewalLeadDaysForCompany(
      assignment?.customerCompanyId ?? null
    )
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
      signer: r.signedBy,
      signerIp: r.signerIp,
      signerUserAgent: r.signerUserAgent,
      validUntil: r.validUntil ? r.validUntil.toISOString() : null,
      validityStatus: getValidityStatus(r.validUntil, new Date(), leadDays),
      files: extractUploadedFiles(r.formData)
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

    const now = new Date()
    const leadDays = await getRenewalLeadDaysForCompany(
      assignment.customerCompanyId
    )

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
        signer: r.signedBy,
        signerIp: r.signerIp,
        signerUserAgent: r.signerUserAgent,
        validUntil: r.validUntil ? r.validUntil.toISOString() : null,
        validityStatus: getValidityStatus(r.validUntil, now, leadDays),
        files: extractUploadedFiles(r.formData)
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
    const user = await prisma.user.findUnique({
      where: { id: signedById },
      select: { customerCompanyId: true }
    })
    const leadDays = await getRenewalLeadDaysForCompany(
      user?.customerCompanyId ?? null
    )
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
    return records.map((r) => toCompletionRecordWithTemplate(r, leadDays))
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
