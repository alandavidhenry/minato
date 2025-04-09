// src/app/api/admin/activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getActivityLogs } from '@/lib/activity-logger'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@/types/rbac'

// GET: List all activity logs
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)

  // Check if user is logged in and has admin or employee role
  if (
    !session?.user?.roles?.some(
      (role) => role === UserRole.ADMIN || role === UserRole.EMPLOYEE
    )
  ) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin or Employee access required.' },
      { status: 403 }
    )
  }

  try {
    // Get query parameters
    const userId = request.nextUrl.searchParams.get('userId')
    const limitParam = request.nextUrl.searchParams.get('limit')

    // Parse limit parameter if provided
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    // Get logs (for all users or a specific user)
    let logs = await getActivityLogs(userId ?? undefined)

    // Apply limit if specified and valid
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
