// src/app/api/admin/companies/[id]/completions/[templateId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getTemplateCompletionSummaryForCompany } from '@/lib/completion-records'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id, templateId } = await params
    const summary = await getTemplateCompletionSummaryForCompany(id, templateId)
    if (!summary) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }
    return NextResponse.json({
      completions: summary.completedRecords,
      outstandingUsers: summary.outstandingUsers,
      templateTitle: summary.templateTitle,
      dueDate: summary.dueDate,
      isOverdue: summary.isOverdue
    })
  } catch (error) {
    console.error('Error fetching completions for template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completions' },
      { status: 500 }
    )
  }
}
