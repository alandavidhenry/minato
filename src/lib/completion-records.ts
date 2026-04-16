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

export interface CompletionRecordForAdmin {
  id: string
  signedAt: string
  blobPath: string | null
  signer: { id: string; displayName: string; email: string }
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
  signedBy: { id: string; displayName: string; email: string }
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
