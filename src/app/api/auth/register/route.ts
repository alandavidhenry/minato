// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { enrollUserInMatchingAssignments } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { createUser } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

// POST: Register a new user (admin only)
export async function POST(request: NextRequest) {
  // Check if user is admin (only admins can create users)
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const data = await request.json()

    if (!data.displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const hasEmail = Boolean(data.email)
    const hasPassword = Boolean(data.password)

    // Workers with email must also have a password
    if (hasEmail && !hasPassword) {
      return NextResponse.json(
        { error: 'Password is required when email is provided' },
        { status: 400 }
      )
    }

    // No-email workers must have a line manager for notification routing
    if (!hasEmail && !data.lineManagerId) {
      return NextResponse.json(
        {
          error:
            'No-email workers must have a line manager assigned for notification routing'
        },
        { status: 400 }
      )
    }

    const user = await createUser({
      email: data.email || undefined,
      password: data.password || undefined,
      displayName: data.displayName,
      role: data.role || 'Customer User',
      jobRole: data.jobRole || undefined,
      customerCompanyId: data.customerCompanyId || undefined,
      lineManagerId: data.lineManagerId || undefined
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User already exists or could not be created' },
        { status: 400 }
      )
    }

    if (user.customerCompanyId) {
      await enrollUserInMatchingAssignments(
        user.id,
        user.customerCompanyId,
        user.jobRole
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
