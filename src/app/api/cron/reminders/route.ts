import { NextRequest, NextResponse } from 'next/server'

import { sendReminderNotification } from '@/lib/email'
import { getAssignmentsNeedingReminders } from '@/lib/reminders'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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

    const sent = targets.reduce((sum, t) => sum + t.recipients.length, 0)
    return NextResponse.json({ sent })
  } catch (error) {
    console.error('Reminder cron error:', error)
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    )
  }
}
