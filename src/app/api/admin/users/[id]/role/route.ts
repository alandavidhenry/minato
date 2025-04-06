// src/app/api/admin/users/[id]/role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { updateUser } from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

// Middleware to check admin permissions
async function checkAdminPermission() {
  const session = await getServerSession(authOptions)

  // Check if user is logged in and has admin role
  if (!session?.user?.roles?.includes(UserRole.ADMIN)) {
    return false
  }

  return true
}

// POST: Assign a role to a user
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin permissions
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const userId = params.id
    const { role } = await request.json()

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    // Validate the role
    const validRoles = ['Administrator', 'Employee', 'Customer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Update the user's role
    const success = await updateUser(userId, { role })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to assign role. User not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error assigning role to user ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to assign role' },
      { status: 500 }
    )
  }
}

// DELETE: This endpoint was for removing Azure AD roles, which we don't need anymore
// We'll implement a simplified version that just sets the role to "Customer"
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check admin permissions
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const userId = params.id

    // Set role to "Customer" (default role)
    const success = await updateUser(userId, { role: 'Customer' })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove role. User not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error removing role from user ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to remove role' },
      { status: 500 }
    )
  }
}
