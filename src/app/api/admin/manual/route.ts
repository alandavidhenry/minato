// src/app/api/admin/manual/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { generateUserManualPDF } from '@/lib/pdf/user-manual-pdf'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const buffer = await generateUserManualPDF()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="document-portal-user-guide.pdf"'
      }
    })
  } catch (error) {
    console.error('Error generating user manual PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
