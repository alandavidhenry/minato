// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getUserByEmail, updateUser, deleteUser } from '@/lib/user-database'
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

// GET: Get a specific user
export async function GET(
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

    // Get the user from database (userId is the email in this case)
    const user = await getUserByEmail(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Format the user data for the frontend
    const formattedUser = {
      id: user.id,
      displayName: user.displayName,
      mail: user.email,
      userPrincipalName: user.email,
      accountEnabled: true,
      createdDateTime: user.createdAt,
      role: user.role
    }

    return NextResponse.json({ user: formattedUser })
  } catch (error) {
    console.error(`Error fetching user ${params.id}:`, error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH: Update a user
export async function PATCH(
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
    const updates = await request.json()

    // Map the updates to the format expected by our database function
    const userUpdates: Partial<{
      displayName: string
      role: string
      accountEnabled: boolean
    }> = {}

    if (updates.displayName) userUpdates.displayName = updates.displayName
    if (updates.role) userUpdates.role = updates.role
    if (updates.accountEnabled !== undefined) {
      // Note: our database doesn't track account status, so this is a no-op
      // You could add this field to your user schema if needed
    }

    // Update the user in the database
    const success = await updateUser(userId, userUpdates)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error updating user ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a user
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

    // Delete the user from the database
    const success = await deleteUser(userId)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error deleting user ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
