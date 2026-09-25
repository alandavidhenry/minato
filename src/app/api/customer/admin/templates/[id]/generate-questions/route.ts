// src/app/api/customer/admin/templates/[id]/generate-questions/route.ts
// Customer-admin equivalent of /api/admin/templates/[id]/generate-questions
// (P17 self-serve portal parity). Nothing is written to the database here -
// the company admin reviews/edits the suggestions in edit-template-dialog.tsx
// and only persists them via the existing Save/Publish flow.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { generateComprehensionQuestions } from '@/lib/comprehension-question-generation'
import { getTemplateSourceText } from '@/lib/comprehension-question-source'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { UserRole } from '@/types/rbac'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  const { id } = await params
  const template = await getDocumentTemplateById(id)

  if (!template || template.ownerCompanyId !== companyId) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  let sourceText: string
  try {
    sourceText = await getTemplateSourceText(template)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not read this template to generate questions from.'
      },
      { status: 400 }
    )
  }

  try {
    const questions = await generateComprehensionQuestions(sourceText)
    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Error generating comprehension questions:', error)
    return NextResponse.json(
      { error: 'Failed to generate comprehension questions.' },
      { status: 500 }
    )
  }
}
