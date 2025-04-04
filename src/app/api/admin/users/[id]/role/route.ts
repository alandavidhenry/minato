// src/app/api/admin/users/[id]/role/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  getGraphClient,
  assignAppRoleToUser,
  removeAppRoleFromUser
} from '@/lib/graph-api'
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
  context: { params: { id: string } }
) {
  // Check admin permissions
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  const id = context.params.id

  try {
    const { role } = await request.json()

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    // Get the appropriate role ID
    let appRoleId

    if (role === 'Administrator') {
      appRoleId = process.env.AZURE_AD_ADMIN_ROLE_ID
    } else if (role === 'User') {
      appRoleId = process.env.AZURE_AD_USER_ROLE_ID
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (!process.env.AZURE_AD_CLIENT_ID) {
      throw new Error('AZURE_AD_CLIENT_ID environment variable is not set')
    }

    if (!appRoleId) {
      throw new Error('appRoleId is required')
    }

    // Check existing role assignments
    try {
      const client = getGraphClient()
      const userAppRoles = await client
        .api(`/users/${id}/appRoleAssignments`)
        .get()

      // Check if this role is already assigned
      const existingAssignment = userAppRoles.value.find(
        (assignment: any) => assignment.appRoleId === appRoleId
      )

      if (existingAssignment) {
        // Role already assigned - return success
        return NextResponse.json({
          success: true,
          message: 'Role was already assigned'
        })
      }

      // Role not assigned, proceed with assignment
      await assignAppRoleToUser(id, process.env.AZURE_AD_CLIENT_ID, appRoleId)

      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error(`Error checking or assigning role to user ${id}:`, error)
      return NextResponse.json(
        {
          error: 'Failed to assign role',
          details: error.message || String(error)
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error(`Error processing role assignment for user ${id}:`, error)
    return NextResponse.json(
      { error: 'Failed to assign role' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a role from a user
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
    const { appRoleAssignmentId } = await request.json()

    if (!appRoleAssignmentId) {
      return NextResponse.json(
        { error: 'Role assignment ID is required' },
        { status: 400 }
      )
    }

    await removeAppRoleFromUser(userId, appRoleAssignmentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error removing role from user ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Failed to remove role' },
      { status: 500 }
    )
  }
}
