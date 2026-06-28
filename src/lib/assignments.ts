import type { Prisma } from '@/generated/prisma/client'
import type { ComprehensionQuestionForClient } from '@/types/comprehension-question'
import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'

export interface AssignmentData {
  id: string
  templateId: string
  customerCompanyId: string
  userId: string | null
  dueDate: string | null
  targetJobRoles: string[] | null
  templateVersion: number
  createdAt: string
}

export interface AssignmentWithTemplate extends AssignmentData {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: FormSchema | null
    questions: ComprehensionQuestionForClient[] | null
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
}

type PrismaAssignmentWithTemplate = PrismaAssignment & {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: unknown
    questions: unknown
  }
}

function toJsonValue(
  value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return 'DbNull'
  return value as Prisma.InputJsonValue
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
  questions: true
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
    createdAt: a.createdAt.toISOString()
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
      questions
    }
  }
}

export async function createAssignment({
  templateId,
  customerCompanyId,
  userId,
  dueDate,
  targetJobRoles,
  templateVersion = 1
}: {
  templateId: string
  customerCompanyId: string
  userId?: string
  dueDate?: string
  targetJobRoles?: string[]
  templateVersion?: number
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
        templateVersion
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
          templateVersion: newVersion
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

export async function deleteAssignment(id: string): Promise<boolean> {
  try {
    await prisma.assignment.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return false
  }
}
