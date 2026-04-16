import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'

export interface AssignmentData {
  id: string
  templateId: string
  customerCompanyId: string
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

function toAssignmentData(a: PrismaAssignment): AssignmentData {
  return {
    id: a.id,
    templateId: a.templateId,
    customerCompanyId: a.customerCompanyId,
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
  customerCompanyId
}: {
  templateId: string
  customerCompanyId: string
}): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.create({
      data: { templateId, customerCompanyId }
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
      include: {
        template: {
          select: {
            id: true,
            title: true,
            description: true,
            blobPath: true,
            formSchema: true
          }
        }
      }
    })
    if (!assignment) return null
    return toAssignmentWithTemplate(assignment)
  } catch (error) {
    console.error('Error getting assignment with template:', error)
    return null
  }
}

export async function getAssignmentByTemplateAndCompany(
  templateId: string,
  customerCompanyId: string
): Promise<AssignmentData | null> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { templateId_customerCompanyId: { templateId, customerCompanyId } }
    })
    if (!assignment) return null
    return toAssignmentData(assignment)
  } catch (error) {
    console.error('Error getting assignment by template and company:', error)
    return null
  }
}

export async function getAssignmentsForCompany(
  customerCompanyId: string
): Promise<AssignmentWithTemplate[]> {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { customerCompanyId },
      include: {
        template: {
          select: {
            id: true,
            title: true,
            description: true,
            blobPath: true,
            formSchema: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
    return assignments.map(toAssignmentWithTemplate)
  } catch (error) {
    console.error('Error getting assignments for company:', error)
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
