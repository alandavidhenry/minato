import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { getTemplateVersionHistory } from '@/lib/template-version-history'
import { getUserById } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'
import type { TemplateVersionHistoryEntry } from '@/types/template-version-history'

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    const template = await getDocumentTemplateById(id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const history = await getTemplateVersionHistory(id)

    const authorIds = [
      ...new Set(
        history.map((h) => h.publishedBy).filter((v): v is string => v !== null)
      )
    ]
    const authors = await Promise.all(
      authorIds.map((userId) => getUserById(userId))
    )
    const authorNames = new Map(
      authors
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .map((u) => [u.id, u.displayName])
    )

    const currentEntry: TemplateVersionHistoryEntry = {
      id: `current-${template.id}`,
      templateId: template.id,
      version: template.version,
      changeReason: null,
      snapshot: {
        title: template.title,
        description: template.description,
        formSchema: template.formSchema,
        questions: template.questions
      },
      publishedAt: template.updatedAt,
      publishedBy: null,
      publishedByName: null,
      isCurrent: true
    }

    const historyEntries: TemplateVersionHistoryEntry[] = history.map((h) => ({
      id: h.id,
      templateId: h.templateId,
      version: h.version,
      changeReason: h.changeReason,
      snapshot: h.snapshot,
      publishedAt: h.publishedAt,
      publishedBy: h.publishedBy,
      publishedByName: h.publishedBy
        ? (authorNames.get(h.publishedBy) ?? null)
        : null,
      isCurrent: false
    }))

    const entries = [currentEntry, ...historyEntries].sort(
      (a, b) => b.version - a.version
    )

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Error getting template version history:', error)
    return NextResponse.json(
      { error: 'Failed to get template version history' },
      { status: 500 }
    )
  }
}
