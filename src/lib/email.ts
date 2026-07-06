import { EmailClient } from '@azure/communication-email'

export interface AssignmentRecipient {
  email: string
  name: string
}

function makeClient(): EmailClient {
  return new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING!)
}

// Sends one email per recipient, awaiting each send to completion. The subject
// is shared; the HTML body is built per-recipient so it can address them by name.
async function sendEmails(
  recipients: AssignmentRecipient[],
  subject: string,
  buildHtml: (name: string) => string
): Promise<void> {
  if (recipients.length === 0) return

  const client = makeClient()

  await Promise.all(
    recipients.map(async ({ email, name }) => {
      const poller = await client.beginSend({
        senderAddress: process.env.ACS_SENDER_ADDRESS!,
        recipients: {
          to: [{ address: email, displayName: name }]
        },
        content: {
          subject,
          html: buildHtml(name)
        }
      })
      await poller.pollUntilDone()
    })
  )
}

export async function sendAssignmentNotification(
  recipients: AssignmentRecipient[],
  templateTitle: string,
  dueDate: string | null,
  baseUrl: string
): Promise<void> {
  const dueDateLine = dueDate
    ? `<p>Due date: ${new Date(dueDate).toLocaleDateString('en-GB')}</p>`
    : ''

  const link = `${baseUrl}/customer/documents`

  await sendEmails(
    recipients,
    `New document assigned: ${templateTitle}`,
    (name) => `
            <p>Hi ${name},</p>
            <p>A new document has been assigned to you: <strong>${templateTitle}</strong></p>
            ${dueDateLine}
            <p><a href="${link}">Click here to view your assigned documents</a></p>
          `
  )
}

export async function sendReminderNotification(
  recipients: AssignmentRecipient[],
  templateTitle: string,
  dueDate: string,
  isOverdue: boolean,
  baseUrl: string
): Promise<void> {
  const formattedDate = new Date(dueDate).toLocaleDateString('en-GB')
  const subject = isOverdue
    ? `Overdue: ${templateTitle} was due ${formattedDate}`
    : `Reminder: ${templateTitle} is due ${formattedDate}`

  const urgencyLine = isOverdue
    ? `<p><strong>This document is overdue.</strong> It was due on ${formattedDate}.</p>`
    : `<p>This document is due on ${formattedDate}.</p>`

  const link = `${baseUrl}/customer/documents`

  await sendEmails(
    recipients,
    subject,
    (name) => `
            <p>Hi ${name},</p>
            <p>This is a reminder that you have not yet completed: <strong>${templateTitle}</strong></p>
            ${urgencyLine}
            <p><a href="${link}">Click here to view your assigned documents</a></p>
          `
  )
}
