import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDocumentTemplatesByOwnerCompany } from '@/lib/document-templates'
import { ADMIN_ROLES } from '@/types/rbac'

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
    const { id: customerCompanyId } = await params
    const templates =
      await getDocumentTemplatesByOwnerCompany(customerCompanyId)
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching company templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}
