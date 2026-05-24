// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getAllUsers } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

// Middleware to check admin permissions
async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

// GET: List all users
export async function GET(_request: NextRequest) {
  // Check admin permissions
  const isAdmin = await checkAdminPermission()

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    // Get users directly from your database - no more Azure AD integration
    const users = await getAllUsers()

    // Format the users for API consumption
    const formattedUsers = users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      mail: user.email,
      userPrincipalName: user.email,
      accountEnabled: true,
      createdDateTime: user.createdAt,
      role: user.role,
      jobRole: user.jobRole,
      lineManagerId: user.lineManagerId,
      customerCompanyId: user.customerCompanyId,
      appRoleAssignments: [
        {
          id: 'local-role',
          resourceDisplayName: 'Document Portal',
          principalDisplayName: user.displayName,
          appRoleId: user.role
        }
      ]
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
