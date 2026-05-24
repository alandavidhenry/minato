import type { Prisma } from '@/generated/prisma/client'
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'

export interface DocumentTemplateData {
  id: string
  title: string
  description: string | null
  blobPath: string | null
  formSchema: FormSchema | null
  questions: ComprehensionQuestion[] | null
  version: number
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

type PrismaDocumentTemplate = {
  id: string
  title: string
  description: string | null
  blobPath: string | null
  formSchema: unknown
  questions: unknown
  version: number
  tenantId: string | null
  createdAt: Date
  updatedAt: Date
}

function toDocumentTemplateData(
  template: PrismaDocumentTemplate
): DocumentTemplateData {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    blobPath: template.blobPath,
    formSchema: (template.formSchema as FormSchema | null) ?? null,
    questions: (template.questions as ComprehensionQuestion[] | null) ?? null,
    version: template.version,
    tenantId: template.tenantId,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  }
}

function toJsonValue(
  value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return 'DbNull'
  return value as Prisma.InputJsonValue
}

export async function createDocumentTemplate({
  title,
  description,
  blobPath,
  formSchema,
  questions,
  tenantId
}: {
  title: string
  description?: string
  blobPath?: string
  formSchema?: FormSchema
  questions?: ComprehensionQuestion[]
  tenantId?: string
}): Promise<DocumentTemplateData | null> {
  try {
    const template = await prisma.documentTemplate.create({
      data: {
        title,
        description,
        blobPath,
        formSchema: toJsonValue(formSchema),
        questions: toJsonValue(questions),
        tenantId
      }
    })
    return toDocumentTemplateData(template)
  } catch (error) {
    console.error('Error creating document template:', error)
    return null
  }
}

export async function getAllDocumentTemplates(): Promise<
  DocumentTemplateData[]
> {
  try {
    const templates = await prisma.documentTemplate.findMany({
      orderBy: { title: 'asc' }
    })
    return templates.map(toDocumentTemplateData)
  } catch (error) {
    console.error('Error getting document templates:', error)
    return []
  }
}

export async function getDocumentTemplateById(
  id: string
): Promise<DocumentTemplateData | null> {
  try {
    const template = await prisma.documentTemplate.findUnique({ where: { id } })
    if (!template) return null
    return toDocumentTemplateData(template)
  } catch (error) {
    console.error('Error getting document template:', error)
    return null
  }
}

export async function updateDocumentTemplate(
  id: string,
  updates: {
    title?: string
    description?: string
    blobPath?: string
    formSchema?: FormSchema | null
    questions?: ComprehensionQuestion[] | null
  }
): Promise<boolean> {
  try {
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && {
          description: updates.description
        }),
        ...(updates.blobPath !== undefined && { blobPath: updates.blobPath }),
        ...('formSchema' in updates && {
          formSchema: toJsonValue(updates.formSchema)
        }),
        ...('questions' in updates && {
          questions: toJsonValue(updates.questions)
        })
      }
    })
    return true
  } catch (error) {
    console.error('Error updating document template:', error)
    return false
  }
}

export async function deleteDocumentTemplate(id: string): Promise<boolean> {
  try {
    await prisma.documentTemplate.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting document template:', error)
    return false
  }
}

// Increments the template version and optionally applies content updates.
// Returns the updated template (with the new version number) or null if not found.
export async function publishNewTemplateVersion(
  id: string,
  updates?: {
    title?: string
    description?: string
    blobPath?: string
    formSchema?: FormSchema | null
    questions?: ComprehensionQuestion[] | null
  }
): Promise<DocumentTemplateData | null> {
  try {
    const template = await prisma.documentTemplate.update({
      where: { id },
      data: {
        version: { increment: 1 },
        ...(updates?.title !== undefined && { title: updates.title }),
        ...(updates?.description !== undefined && {
          description: updates.description
        }),
        ...(updates?.blobPath !== undefined && { blobPath: updates.blobPath }),
        ...('formSchema' in (updates ?? {}) && {
          formSchema: toJsonValue(updates!.formSchema)
        }),
        ...('questions' in (updates ?? {}) && {
          questions: toJsonValue(updates!.questions)
        })
      }
    })
    return toDocumentTemplateData(template)
  } catch (error) {
    console.error('Error publishing new template version:', error)
    return null
  }
}
