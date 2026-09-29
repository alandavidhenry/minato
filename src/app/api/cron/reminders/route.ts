import { NextRequest, NextResponse } from 'next/server'

import {
  sendAssignmentNotification,
  sendReminderNotification
} from '@/lib/email'
import prisma from '@/lib/prisma'
import { getAssignmentsNeedingReminders } from '@/lib/reminders'
import { renewExpiringCompletions } from '@/lib/renewals'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Open the next cycle for recurring sign-offs nearing expiry first, so the
    // fresh assignments are announced once and then follow the normal reminders
    const renewals = await renewExpiringCompletions(new Date())
    await Promise.all(
      renewals
        .filter((r) => r.recipients.length > 0)
        .map((r) =>
          sendAssignmentNotification(
            r.recipients,
            r.templateTitle,
            r.dueDate,
            process.env.NEXTAUTH_URL ?? ''
          )
        )
    )

    const targets = await getAssignmentsNeedingReminders(new Date())

    await Promise.all(
      targets.map((target) =>
        sendReminderNotification(
          target.recipients,
          target.assignment.templateTitle,
          target.assignment.dueDate,
          target.assignment.isOverdue,
          process.env.NEXTAUTH_URL ?? ''
        )
      )
    )

    if (targets.length > 0) {
      await prisma.assignment.updateMany({
        where: { id: { in: targets.map((t) => t.assignment.id) } },
        data: { lastReminderSentAt: new Date() }
      })
    }

    const sent = targets.reduce((sum, t) => sum + t.recipients.length, 0)
    return NextResponse.json({ sent, renewed: renewals.length })
  } catch (error) {
    console.error('Reminder cron error:', error)
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    )
  }
}
