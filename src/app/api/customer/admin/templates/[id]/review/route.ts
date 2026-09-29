import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { markTemplateReviewed } from '@/lib/template-reviews'
import { UserRole } from '@/types/rbac'

// "Reviewed - no changes" for a company's own self-serve template
export async function POST(
  request: NextRequest,
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

  try {
    const { id } = await params

    const existing = await getDocumentTemplateById(id)
    if (!existing || existing.ownerCompanyId !== companyId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    let note: string | undefined
    try {
      const body = await request.json()
      if (typeof body.note === 'string') note = body.note.trim() || undefined
    } catch {
      // no body is fine
    }

    const result = await markTemplateReviewed(id, {
      reviewedBy: session?.user?.id,
      note
    })
    if (!result) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error marking template reviewed:', error)
    return NextResponse.json(
      { error: 'Failed to mark template reviewed' },
      { status: 500 }
    )
  }
}
