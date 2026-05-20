// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getUserById, updateUser, deleteUser } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

// Middleware to check admin permissions
async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

// GET: Get a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id: userId } = await params

    const user = await getUserById(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const formattedUser = {
      id: user.id,
      displayName: user.displayName,
      mail: user.email,
      userPrincipalName: user.email,
      accountEnabled: true,
      createdDateTime: user.createdAt,
      role: user.role,
      jobRole: user.jobRole
    }

    return NextResponse.json({ user: formattedUser })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH: Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id: userId } = await params
    const updates = await request.json()

    const userUpdates: Partial<{
      displayName: string
      role: string
      jobRole: string | null
      customerCompanyId: string | null
    }> = {}
    if (updates.displayName) userUpdates.displayName = updates.displayName
    if (updates.role) userUpdates.role = updates.role
    if ('jobRole' in updates) userUpdates.jobRole = updates.jobRole ?? null
    if (updates.customerCompanyId !== undefined)
      userUpdates.customerCompanyId = updates.customerCompanyId

    const success = await updateUser(userId, userUpdates)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id: userId } = await params

    const success = await deleteUser(userId)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
