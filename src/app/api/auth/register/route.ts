// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

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

    // Basic validation
    if (!data.email || !data.password || !data.displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the user
    const user = await createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      role: data.role || 'Customer User',
      jobRole: data.jobRole || undefined,
      customerCompanyId: data.customerCompanyId || undefined
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User already exists or could not be created' },
        { status: 400 }
      )
    }

    // Return success without the password hash
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
