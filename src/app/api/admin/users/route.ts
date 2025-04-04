// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getUsers as getAzureADUsers } from '@/lib/graph-api'
import { getAllUsers, UserData } from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

// Middleware to check admin permissionsF
async function checkAdminPermission() {
  const session = await getServerSession(authOptions)

  // Check if user is logged in and has admin role
  if (!session?.user?.roles?.includes(UserRole.ADMIN)) {
    return false
  }

  return true
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
    // Get users from Azure AD
    const azureUsers = await getAzureADUsers()

    // Get users from our database
    const localUsers = await getAllUsers()

    // Format local users to match Azure AD format
    const formattedLocalUsers = localUsers.map((user: UserData) => {
      // Extract the app role ID logic to make it more readable
      let appRoleId: string;
      if (user.role === 'Administrator') {
        appRoleId = process.env.AZURE_AD_ADMIN_ROLE_ID ?? 'admin-role';
      } else if (user.role === 'Employee') {
        appRoleId = process.env.AZURE_AD_USER_ROLE_ID ?? 'employee-role';
      } else {
        appRoleId = 'customer-role';
      }
    
      return {
        id: user.id,
        displayName: user.displayName,
        mail: user.email,
        userPrincipalName: user.email,
        accountEnabled: true,
        createdDateTime: user.createdAt,
        // Local role storage
        appRoleAssignments: [
          {
            // Simulate app role assignment
            id: 'local-role',
            resourceDisplayName: 'Document Portal',
            principalDisplayName: user.displayName,
            appRoleId: appRoleId
          }
        ]
      };
    });

    // Merge the lists, ensuring no duplicates by email
    const azureEmails = new Set(
      azureUsers.map((user) => user.mail?.toLowerCase())
    )
    const mergedUsers = [
      ...azureUsers,
      ...formattedLocalUsers.filter(
        (user) => !azureEmails.has(user.mail.toLowerCase())
      )
    ]

    return NextResponse.json({ users: mergedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
