import prisma from './prisma'

export interface DocumentTemplateData {
  id: string
  title: string
  description: string | null
  blobPath: string | null
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

type PrismaDocumentTemplate = {
  id: string
  title: string
  description: string | null
  blobPath: string | null
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
    tenantId: template.tenantId,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString()
  }
}

export async function createDocumentTemplate({
  title,
  description,
  blobPath,
  tenantId
}: {
  title: string
  description?: string
  blobPath?: string
  tenantId?: string
}): Promise<DocumentTemplateData | null> {
  try {
    const template = await prisma.documentTemplate.create({
      data: { title, description, blobPath, tenantId }
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
  updates: { title?: string; description?: string; blobPath?: string }
): Promise<boolean> {
  try {
    await prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && {
          description: updates.description
        }),
        ...(updates.blobPath !== undefined && { blobPath: updates.blobPath })
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
