// src/app/api/admin/activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getActivityLogs } from '@/lib/activity-logger'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ADMIN_ROLES, UserRole } from '@/types/rbac'

// Roles that can view activity logs (admins + tenant staff)
const ACTIVITY_ROLES = [...ADMIN_ROLES, UserRole.TENANT_STAFF]

// GET: List all activity logs
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  // Check if user is logged in and has admin or staff role
  if (!roles.some((role) => ACTIVITY_ROLES.includes(role))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin or Employee access required.' },
      { status: 403 }
    )
  }

  try {
    const params = request.nextUrl.searchParams
    const userId = params.get('userId') ?? undefined
    const companyId = params.get('companyId') ?? undefined
    const startDate = params.get('startDate') ?? undefined
    const endDate = params.get('endDate') ?? undefined
    const limitParam = params.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    // Resolve company → user IDs
    let userIds: string[] | undefined
    if (companyId) {
      const companyUsers = await prisma.user.findMany({
        where: { customerCompanyId: companyId },
        select: { id: true }
      })
      userIds = companyUsers.map((u) => u.id)
      // If the company has no users, return empty immediately
      if (userIds.length === 0) {
        return NextResponse.json({ logs: [] })
      }
    }

    // Normalise date strings to full ISO timestamps for OData comparison
    const startIso = startDate ? `${startDate}T00:00:00.000Z` : undefined
    const endIso = endDate ? `${endDate}T23:59:59.999Z` : undefined

    let logs = await getActivityLogs({
      userId,
      userIds,
      startDate: startIso,
      endDate: endIso
    })

    if (limit && !isNaN(limit) && limit > 0) {
      logs = logs.slice(0, limit)
    }

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    )
  }
}
