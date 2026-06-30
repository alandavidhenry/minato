import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getComplianceKPIs } from '@/lib/compliance-kpis'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const kpis = await getComplianceKPIs()
    return NextResponse.json(kpis)
  } catch (error) {
    console.error('Error fetching compliance KPIs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch compliance KPIs' },
      { status: 500 }
    )
  }
}
