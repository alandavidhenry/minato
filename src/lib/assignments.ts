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
  targetJobRoles
}: {
  templateId: string
  customerCompanyId: string
  userId?: string
  dueDate?: string
  targetJobRoles?: string[]
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
        )
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

// Check for an existing company-wide assignment (userId = null)
export async function getAssignmentByTemplateAndCompany(
  templateId: string,
  customerCompanyId: string
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: { templateId, customerCompanyId, userId: null }
    })
    if (!assignment) return null
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error getting assignment by template and company:', error)
    return null
  }
}

// Check for an existing individual assignment for a specific user
export async function getAssignmentByTemplateAndUser(
  templateId: string,
  userId: string
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: { templateId, userId }
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

// Returns the combined visible assignment list for a customer user:
// company-wide assignments + their individual assignments, deduplicated by templateId
// (individual assignment takes precedence when a template appears in both).
// Company-wide assignments with targetJobRoles are only shown when:
//   - targetJobRoles is null/empty (visible to all), OR
//   - userJobRole is null/undefined (user has no role set — sees everything), OR
//   - userJobRole is included in targetJobRoles
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

    const seen = new Set<string>()
    const result: AssignmentWithTemplate[] = []

    // Individual assignments take precedence (not filtered by job role)
    for (const a of individual) {
      seen.add(a.templateId)
      result.push(toAssignmentWithTemplate(a))
    }
    for (const a of companyWide) {
      if (!seen.has(a.templateId)) {
        const converted = toAssignmentWithTemplate(a)
        if (isVisibleToJobRole(converted.targetJobRoles, userJobRole)) {
          seen.add(a.templateId)
          result.push(converted)
        }
      }
    }

    return result.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  } catch (error) {
    console.error('Error getting assignments for user:', error)
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
