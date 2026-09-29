import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { markTemplateReviewed } from '@/lib/template-reviews'
import { ADMIN_ROLES } from '@/types/rbac'

// "Reviewed - no changes": restarts the review date and logs an audit entry
// without bumping the template version or triggering re-signing.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params

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
