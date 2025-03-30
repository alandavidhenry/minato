// src/app/api/admin/users/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { createUser, assignAppRoleToUser } from '@/lib/graph-api'
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
    if (!data.displayName || !data.userPrincipalName || !data.password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create mail nickname if not provided
    if (!data.mailNickname) {
      // Use the part before @ in email
      data.mailNickname = data.userPrincipalName.split('@')[0]
    }

    // Create the user in Microsoft Graph
    const newUser = await createUser({
      displayName: data.displayName,
      mailNickname: data.mailNickname,
      userPrincipalName: data.userPrincipalName,
      password: data.password,
      accountEnabled: data.accountEnabled !== false, // Default to true if not specified
      forceChangePasswordNextSignIn:
        data.forceChangePasswordNextSignIn !== false // Default to true
    })

    // Assign app role if specified
    if (data.role && data.role !== 'Guest') {
      try {
        // Get the appropriate role ID based on the role name
        let appRoleId

        if (data.role === 'Administrator') {
          appRoleId = process.env.AZURE_AD_ADMIN_ROLE_ID
        } else if (data.role === 'User') {
          appRoleId = process.env.AZURE_AD_USER_ROLE_ID
        }

        if (appRoleId) {
          await assignAppRoleToUser(
            newUser.id,
            process.env.AZURE_AD_CLIENT_ID!,
            appRoleId
          )
        }
      } catch (roleError) {
        console.error('Error assigning role:', roleError)
        // We'll still return success since the user was created
      }
    }

    return NextResponse.json({ user: newUser })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
