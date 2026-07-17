import type { Prisma } from '@/generated/prisma/client'
import type { ComprehensionQuestionForClient } from '@/types/comprehension-question'
import type {
  DocumentTemplateSourceType,
  DocumentTemplateUploadMode
} from '@/types/document-template'
import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'
import { toJsonValue } from './prisma-json'

export interface AssignmentData {
  id: string
  templateId: string
  customerCompanyId: string
  userId: string | null
  dueDate: string | null
  targetJobRoles: string[] | null
  templateVersion: number
  createdAt: string
  autoEnroll: boolean
}

export interface AssignmentWithTemplate extends AssignmentData {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: FormSchema | null
    questions: ComprehensionQuestionForClient[] | null
    sourceType: DocumentTemplateSourceType
    uploadMode: DocumentTemplateUploadMode | null
    sourceDocBlobPath: string | null
    sourceDocFileName: string | null
  }
}

type PrismaAssignment = {
  id: string
  templateId: string
  customerCompanyId: string
  userId: string | null
  dueDate: Date | null
  targetJobRoles: unknown
  templateVersion: number
  createdAt: Date
  autoEnroll: boolean
}

type PrismaAssignmentWithTemplate = PrismaAssignment & {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: unknown
    questions: unknown
    sourceType: string
    uploadMode: string | null
    sourceDocBlobPath: string | null
    sourceDocFileName: string | null
  }
}

function isVisibleToJobRole(
  targetJobRoles: string[] | null,
  userJobRole: string | null | undefined
): boolean {
  // No targeting: visible to everyone
  if (!targetJobRoles || targetJobRoles.length === 0) return true
  // User has no job role: sees everything
  if (!userJobRole) return true
  return targetJobRoles.includes(userJobRole)
}

const TEMPLATE_SELECT = {
  id: true,
  title: true,
  description: true,
  blobPath: true,
  formSchema: true,
  questions: true,
  sourceType: true,
  uploadMode: true,
  sourceDocBlobPath: true,
  sourceDocFileName: true
} as const

function toAssignmentData(a: PrismaAssignment): AssignmentData {
  return {
    id: a.id,
    templateId: a.templateId,
    customerCompanyId: a.customerCompanyId,
    userId: a.userId,
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    targetJobRoles: Array.isArray(a.targetJobRoles)
      ? (a.targetJobRoles as string[])
      : null,
    templateVersion: a.templateVersion,
    createdAt: a.createdAt.toISOString(),
    autoEnroll: a.autoEnroll
  }
}

function toAssignmentWithTemplate(
  a: PrismaAssignmentWithTemplate
): AssignmentWithTemplate {
  const rawQuestions = a.template.questions as
    | Array<{ id: string; question: string; options: string[]; answer: string }>
    | null
    | undefined
  const questions: ComprehensionQuestionForClient[] | null = rawQuestions
    ? rawQuestions.map(({ id, question, options }) => ({
        id,
        question,
        options: options ?? []
      }))
    : null

  return {
    ...toAssignmentData(a),
    template: {
      ...a.template,
      formSchema: (a.template.formSchema as FormSchema | null) ?? null,
      questions,
      sourceType: a.template.sourceType as DocumentTemplateSourceType,
      uploadMode: a.template.uploadMode as DocumentTemplateUploadMode | null
    }
  }
}

export async function createAssignment({
  templateId,
  customerCompanyId,
  userId,
  dueDate,
  targetJobRoles,
  templateVersion = 1,
  autoEnroll = false
}: {
  templateId: string
  customerCompanyId: string
  userId?: string
  dueDate?: string
  targetJobRoles?: string[]
  templateVersion?: number
  autoEnroll?: boolean
}): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.create({
      data: {
        templateId,
        customerCompanyId,
        userId: userId ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        targetJobRoles: toJsonValue(
          targetJobRoles && targetJobRoles.length > 0 ? targetJobRoles : null
        ),
        templateVersion,
        // autoEnroll only makes sense for company-wide assignments
        autoEnroll: userId ? false : autoEnroll
      }
    })
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error creating assignment:', error)
    return null
  }
}

export async function getAssignmentById(
  id: string
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id } })
    if (!assignment) return null
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error getting assignment:', error)
    return null
  }
}

export async function getAssignmentWithTemplate(
  id: string
): Promise<AssignmentWithTemplate | null> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { template: { select: TEMPLATE_SELECT } }
    })
    if (!assignment) return null
    return toAssignmentWithTemplate(assignment)
  } catch (error) {
    console.error('Error getting assignment with template:', error)
    return null
  }
}

// Check for an existing company-wide assignment (userId = null).
// Pass templateVersion to scope the check to a specific version.
export async function getAssignmentByTemplateAndCompany(
  templateId: string,
  customerCompanyId: string,
  templateVersion?: number
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: {
        templateId,
        customerCompanyId,
        userId: null,
        ...(templateVersion !== undefined && { templateVersion })
      }
    })
    if (!assignment) return null
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error getting assignment by template and company:', error)
    return null
  }
}

// Check for an existing individual assignment for a specific user.
// Pass templateVersion to scope the check to a specific version.
export async function getAssignmentByTemplateAndUser(
  templateId: string,
  userId: string,
  templateVersion?: number
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: {
        templateId,
        userId,
        ...(templateVersion !== undefined && { templateVersion })
      }
    })
    if (!assignment) return null
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error getting assignment by template and user:', error)
    return null
  }
}

// Returns all company-wide assignments for a company (userId = null)
export async function getAssignmentsForCompany(
  customerCompanyId: string
): Promise<AssignmentWithTemplate[]> {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { customerCompanyId, userId: null },
      include: { template: { select: TEMPLATE_SELECT } },
      orderBy: { createdAt: 'asc' }
    })
    return assignments.map(toAssignmentWithTemplate)
  } catch (error) {
    console.error('Error getting assignments for company:', error)
    return []
  }
}

// Returns all individual assignments for a specific user
export async function getAssignmentsForUserOnly(
  userId: string
): Promise<AssignmentWithTemplate[]> {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { userId },
      include: { template: { select: TEMPLATE_SELECT } },
      orderBy: { createdAt: 'asc' }
    })
    return assignments.map(toAssignmentWithTemplate)
  } catch (error) {
    console.error('Error getting assignments for user:', error)
    return []
  }
}

// Returns the combined visible assignment list for a customer user.
// For each templateId, shows only the highest-version assignment.
// At the same version, individual assignment beats company-wide.
// Company-wide assignments with targetJobRoles are filtered by job role.
export async function getAssignmentsForUser(
  userId: string,
  customerCompanyId: string,
  userJobRole?: string | null
): Promise<AssignmentWithTemplate[]> {
  try {
    const [companyWide, individual] = await Promise.all([
      prisma.assignment.findMany({
        where: { customerCompanyId, userId: null },
        include: { template: { select: TEMPLATE_SELECT } },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.assignment.findMany({
        where: { userId },
        include: { template: { select: TEMPLATE_SELECT } },
        orderBy: { createdAt: 'asc' }
      })
    ])

    // Per templateId, keep the assignment with the highest templateVersion.
    // If two assignments share the same templateId and version, individual wins.
    const bestByTemplate = new Map<string, PrismaAssignmentWithTemplate>()

    function maybeSet(
      candidate: PrismaAssignmentWithTemplate,
      isIndividual: boolean
    ) {
      const existing = bestByTemplate.get(candidate.templateId)
      if (!existing) {
        bestByTemplate.set(candidate.templateId, candidate)
        return
      }
      const existingIsIndividual = existing.userId !== null
      if (
        candidate.templateVersion > existing.templateVersion ||
        (candidate.templateVersion === existing.templateVersion &&
          isIndividual &&
          !existingIsIndividual)
      ) {
        bestByTemplate.set(candidate.templateId, candidate)
      }
    }

    for (const a of individual) {
      maybeSet(a, true)
    }

    for (const a of companyWide) {
      const converted = toAssignmentWithTemplate(a)
      if (!isVisibleToJobRole(converted.targetJobRoles, userJobRole)) continue
      maybeSet(a, false)
    }

    return Array.from(bestByTemplate.values())
      .map(toAssignmentWithTemplate)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
  } catch (error) {
    console.error('Error getting assignments for user:', error)
    return []
  }
}

// Creates new assignments at `newVersion` for every scope (company/user) that
// had an assignment at `newVersion - 1` for the given template.
// Returns the newly created assignments.
export async function createAssignmentsForNewVersion(
  templateId: string,
  newVersion: number
): Promise<AssignmentData[]> {
  const previousVersion = newVersion - 1
  try {
    const previous = await prisma.assignment.findMany({
      where: { templateId, templateVersion: previousVersion }
    })

    if (previous.length === 0) return []

    const created: AssignmentData[] = []
    for (const prev of previous) {
      const assignment = await prisma.assignment.create({
        data: {
          templateId,
          customerCompanyId: prev.customerCompanyId,
          userId: prev.userId,
          dueDate: null, // new version starts without a due date
          targetJobRoles: prev.targetJobRoles as
            Prisma.InputJsonValue | undefined,
          templateVersion: newVersion,
          autoEnroll: prev.autoEnroll
        }
      })
      created.push(toAssignmentData(assignment))
    }
    return created
  } catch (error) {
    console.error('Error creating assignments for new version:', error)
    return []
  }
}

// Auto-enrollment (P16): company-wide assignments with autoEnroll=true create an
// individual Assignment record (audit trail: "enrolled on [date]") for each user
// whose jobRole matches targetJobRoles. Unlike the permissive isVisibleToJobRole
// used for viewing, a user with no jobRole does not match a role-restricted
// autoEnroll assignment — enrollment requires an explicit role match.
function jobRoleMatchesForAutoEnroll(
  targetJobRoles: string[] | null,
  userJobRole: string | null | undefined
): boolean {
  if (!targetJobRoles || targetJobRoles.length === 0) return true
  if (!userJobRole) return false
  return targetJobRoles.includes(userJobRole)
}

// Creates an individual enrolment Assignment for `userId` for every autoEnroll=true
// company-wide assignment in their company whose targetJobRoles matches jobRole.
// Skips templates the user is already individually assigned to at that version.
export async function enrollUserInMatchingAssignments(
  userId: string,
  customerCompanyId: string,
  jobRole: string | null
): Promise<AssignmentData[]> {
  try {
    const candidates = await prisma.assignment.findMany({
      where: { customerCompanyId, userId: null, autoEnroll: true }
    })

    const created: AssignmentData[] = []
    for (const candidate of candidates) {
      const targetJobRoles = Array.isArray(candidate.targetJobRoles)
        ? (candidate.targetJobRoles as string[])
        : null
      if (!jobRoleMatchesForAutoEnroll(targetJobRoles, jobRole)) continue

      const existing = await prisma.assignment.findFirst({
        where: {
          templateId: candidate.templateId,
          userId,
          templateVersion: candidate.templateVersion
        }
      })
      if (existing) continue

      const assignment = await prisma.assignment.create({
        data: {
          templateId: candidate.templateId,
          customerCompanyId,
          userId,
          dueDate: candidate.dueDate,
          templateVersion: candidate.templateVersion,
          autoEnroll: false
        }
      })
      created.push(toAssignmentData(assignment))
    }
    return created
  } catch (error) {
    console.error('Error enrolling user in matching assignments:', error)
    return []
  }
}

// Creates an individual enrolment Assignment for every user in the company whose
// jobRole matches `assignment.targetJobRoles`, when `assignment` is a company-wide
// autoEnroll assignment. No-op for individual assignments or autoEnroll=false.
export async function enrollMatchingUsersForAssignment(
  assignment: AssignmentData
): Promise<AssignmentData[]> {
  if (assignment.userId || !assignment.autoEnroll) return []

  try {
    const users = await prisma.user.findMany({
      where: { customerCompanyId: assignment.customerCompanyId },
      select: { id: true, jobRole: true }
    })

    const created: AssignmentData[] = []
    for (const user of users) {
      if (!jobRoleMatchesForAutoEnroll(assignment.targetJobRoles, user.jobRole))
        continue

      const existing = await prisma.assignment.findFirst({
        where: {
          templateId: assignment.templateId,
          userId: user.id,
          templateVersion: assignment.templateVersion
        }
      })
      if (existing) continue

      const newAssignment = await prisma.assignment.create({
        data: {
          templateId: assignment.templateId,
          customerCompanyId: assignment.customerCompanyId,
          userId: user.id,
          dueDate: assignment.dueDate ? new Date(assignment.dueDate) : null,
          templateVersion: assignment.templateVersion,
          autoEnroll: false
        }
      })
      created.push(toAssignmentData(newAssignment))
    }
    return created
  } catch (error) {
    console.error('Error enrolling matching users for assignment:', error)
    return []
  }
}

export async function deleteAssignment(id: string): Promise<boolean> {
  try {
    await prisma.assignment.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return false
  }
}
