import { NextResponse } from 'next/server'

import { deleteResetToken, validateResetToken } from '@/lib/password-reset'
import { changePassword } from '@/lib/user-database'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const email = await validateResetToken(token)
    if (!email) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    const success = await changePassword(email, password)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    await deleteResetToken(email)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
