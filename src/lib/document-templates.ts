import type { Prisma } from '@/generated/prisma/client'
import type { FormSchema } from '@/types/form-schema'

import prisma from './prisma'

export interface DocumentTemplateData {
  id: string
  title: string
  description: string | null
  blobPath: string | null
  formSchema: FormSchema | null
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
    tenantId: template.tenantId,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  }
}

function toJsonValue(
  value: FormSchema | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return 'DbNull'
  return value as unknown as Prisma.InputJsonValue
}

export async function createDocumentTemplate({
  title,
  description,
  blobPath,
  formSchema,
  tenantId
}: {
  title: string
  description?: string
  blobPath?: string
  formSchema?: FormSchema
  tenantId?: string
}): Promise<DocumentTemplateData | null> {
  try {
    const template = await prisma.documentTemplate.create({
      data: {
        title,
        description,
        blobPath,
        formSchema: toJsonValue(formSchema),
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
