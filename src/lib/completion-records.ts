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
