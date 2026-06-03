import { EmailClient } from '@azure/communication-email'
import { NextResponse } from 'next/server'

import { createResetToken } from '@/lib/password-reset'
import { getUserByEmail } from '@/lib/user-database'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Always return success — never reveal whether an email address exists
    const user = await getUserByEmail(email.toLowerCase().trim())
    if (user?.email) {
      const token = await createResetToken(user.email)
      const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`

      const client = new EmailClient(
        process.env.AZURE_COMMUNICATION_CONNECTION_STRING!
      )

      const poller = await client.beginSend({
        senderAddress: process.env.ACS_SENDER_ADDRESS!,
        recipients: {
          to: [{ address: user.email }]
        },
        content: {
          subject: 'Reset your password',
          html: `
            <p>You requested a password reset for your Minato account.</p>
            <p><a href="${resetUrl}">Click here to reset your password</a></p>
            <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
          `
        }
      })

      await poller.pollUntilDone()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 })
  }
}
