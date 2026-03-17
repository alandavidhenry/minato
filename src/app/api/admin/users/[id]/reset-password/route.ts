// src/app/api/admin/users/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { changePassword } from '@/lib/user-database'
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

// POST: Reset a user's password
export async function POST(
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
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const success = await changePassword(userId, password)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reset password. User not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
