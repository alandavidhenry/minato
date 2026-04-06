// src/app/api/admin/users/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { createUser } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

// Middleware to check admin permissions
async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

// POST: Create a new user
export async function POST(request: NextRequest) {
  // Check admin permissions
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const data = await request.json()

    // Basic validation
    if (!data.displayName || !data.email || !data.password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the user in your local database
    const newUser = await createUser({
      displayName: data.displayName,
      email: data.email,
      password: data.password,
      role: data.role || 'Customer User'
    })

    if (!newUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Format the response to match what the frontend expects
    const formattedUser = {
      id: newUser.id,
      displayName: newUser.displayName,
      mail: newUser.email,
      userPrincipalName: newUser.email,
      accountEnabled: true,
      createdDateTime: newUser.createdAt,
      role: newUser.role
    }

    return NextResponse.json({ user: formattedUser })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
