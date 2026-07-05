import type { Prisma } from '@/generated/prisma/client'
import type { TemplateSnapshot } from '@/types/template-version-history'

import prisma from './prisma'

export interface TemplateVersionHistoryData {
  id: string
  templateId: string
  version: number
  changeReason: string | null
  snapshot: TemplateSnapshot
  publishedAt: string
  publishedBy: string | null
}

type PrismaTemplateVersionHistory = {
  id: string
  templateId: string
  version: number
  changeReason: string | null
  snapshot: unknown
  publishedAt: Date
  publishedBy: string | null
}

function toTemplateVersionHistoryData(
  entry: PrismaTemplateVersionHistory
): TemplateVersionHistoryData {
  return {
    id: entry.id,
    templateId: entry.templateId,
    version: entry.version,
    changeReason: entry.changeReason,
    snapshot: entry.snapshot as TemplateSnapshot,
    publishedAt: entry.publishedAt.toISOString(),
    publishedBy: entry.publishedBy
  }
}

export async function createTemplateVersionHistoryEntry({
  templateId,
  version,
  changeReason,
  snapshot,
  publishedBy
}: {
  templateId: string
  version: number
  changeReason?: string | null
  snapshot: TemplateSnapshot
  publishedBy?: string | null
}): Promise<TemplateVersionHistoryData | null> {
  try {
    const entry = await prisma.templateVersionHistory.create({
      data: {
        templateId,
        version,
        changeReason,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        publishedBy
      }
    })
    return toTemplateVersionHistoryData(entry)
  } catch (error) {
    console.error('Error creating template version history entry:', error)
    return null
  }
}

export async function getTemplateVersionHistory(
  templateId: string
): Promise<TemplateVersionHistoryData[]> {
  try {
    const entries = await prisma.templateVersionHistory.findMany({
      where: { templateId },
      orderBy: { version: 'desc' }
    })
    return entries.map(toTemplateVersionHistoryData)
  } catch (error) {
    console.error('Error getting template version history:', error)
    return []
  }
}
