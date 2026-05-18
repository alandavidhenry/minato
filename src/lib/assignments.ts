import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'

export interface AssignmentData {
  id: string
  templateId: string
  customerCompanyId: string
  userId: string | null
  createdAt: string
}

export interface AssignmentWithTemplate extends AssignmentData {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: FormSchema | null
  }
}

type PrismaAssignment = {
  id: string
  templateId: string
  customerCompanyId: string
  userId: string | null
  createdAt: Date
}

type PrismaAssignmentWithTemplate = PrismaAssignment & {
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
    formSchema: unknown
  }
}

const TEMPLATE_SELECT = {
  id: true,
  title: true,
  description: true,
  blobPath: true,
  formSchema: true
} as const

function toAssignmentData(a: PrismaAssignment): AssignmentData {
  return {
    id: a.id,
    templateId: a.templateId,
    customerCompanyId: a.customerCompanyId,
    userId: a.userId,
    createdAt: a.createdAt.toISOString()
  }
}

function toAssignmentWithTemplate(
  a: PrismaAssignmentWithTemplate
): AssignmentWithTemplate {
  return {
    ...toAssignmentData(a),
    template: {
      ...a.template,
      formSchema: (a.template.formSchema as FormSchema | null) ?? null
    }
  }
}

export async function createAssignment({
  templateId,
  customerCompanyId,
  userId
}: {
  templateId: string
  customerCompanyId: string
  userId?: string
}): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.create({
      data: { templateId, customerCompanyId, userId: userId ?? null }
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
export async function getAssignmentsForUser(
  userId: string,
  customerCompanyId: string
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

    // Individual assignments take precedence
    for (const a of individual) {
      seen.add(a.templateId)
      result.push(toAssignmentWithTemplate(a))
    }
    for (const a of companyWide) {
      if (!seen.has(a.templateId)) {
        seen.add(a.templateId)
        result.push(toAssignmentWithTemplate(a))
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
