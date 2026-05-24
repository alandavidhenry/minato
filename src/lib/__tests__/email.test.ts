import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendAssignmentNotification, sendReminderNotification } from '../email'

const { mockBeginSend, mockPollUntilDone } = vi.hoisted(() => ({
  mockBeginSend: vi.fn(),
  mockPollUntilDone: vi.fn()
}))

vi.mock('@azure/communication-email', () => ({
  EmailClient: class {
    beginSend = mockBeginSend
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockPollUntilDone.mockResolvedValue(undefined)
  mockBeginSend.mockResolvedValue({ pollUntilDone: mockPollUntilDone })
  process.env.AZURE_COMMUNICATION_CONNECTION_STRING =
    'endpoint=https://test;accesskey=abc'
  process.env.ACS_SENDER_ADDRESS = 'noreply@test.com'
})

describe('sendAssignmentNotification', () => {
  it('sends nothing when recipients list is empty', async () => {
    await sendAssignmentNotification(
      [],
      'Safety Checklist',
      null,
      'http://localhost:3000'
    )
    expect(mockBeginSend).not.toHaveBeenCalled()
  })

  it('sends one email per recipient', async () => {
    await sendAssignmentNotification(
      [
        { email: 'user1@test.com', name: 'User One' },
        { email: 'user2@test.com', name: 'User Two' }
      ],
      'Safety Checklist',
      null,
      'http://localhost:3000'
    )
    expect(mockBeginSend).toHaveBeenCalledTimes(2)
    expect(mockPollUntilDone).toHaveBeenCalledTimes(2)
  })

  it('includes template title in email subject', async () => {
    await sendAssignmentNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Farmyard Safety Checklist',
      null,
      'http://localhost:3000'
    )
    expect(mockBeginSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          subject: 'New document assigned: Farmyard Safety Checklist'
        })
      })
    )
  })

  it('includes formatted due date in email body when provided', async () => {
    await sendAssignmentNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Safety Checklist',
      '2026-06-30T00:00:00.000Z',
      'http://localhost:3000'
    )
    const html = mockBeginSend.mock.calls[0][0].content.html as string
    expect(html).toContain('30/06/2026')
  })

  it('omits due date line when dueDate is null', async () => {
    await sendAssignmentNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Safety Checklist',
      null,
      'http://localhost:3000'
    )
    const html = mockBeginSend.mock.calls[0][0].content.html as string
    expect(html).not.toContain('Due date:')
  })

  it('includes link to customer documents page', async () => {
    await sendAssignmentNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Safety Checklist',
      null,
      'https://portal.example.com'
    )
    const html = mockBeginSend.mock.calls[0][0].content.html as string
    expect(html).toContain('https://portal.example.com/customer/documents')
  })

  it('sends to correct recipient address', async () => {
    await sendAssignmentNotification(
      [{ email: 'alice@company.com', name: 'Alice' }],
      'Safety Checklist',
      null,
      'http://localhost:3000'
    )
    expect(mockBeginSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: {
          to: [{ address: 'alice@company.com', displayName: 'Alice' }]
        }
      })
    )
  })

  it('throws when ACS send fails', async () => {
    mockBeginSend.mockRejectedValueOnce(new Error('ACS error'))
    await expect(
      sendAssignmentNotification(
        [{ email: 'user@test.com', name: 'User' }],
        'Safety Checklist',
        null,
        'http://localhost:3000'
      )
    ).rejects.toThrow('ACS error')
  })
})

describe('sendReminderNotification', () => {
  it('sends nothing when recipients list is empty', async () => {
    await sendReminderNotification(
      [],
      'Safety Checklist',
      '2026-06-10T00:00:00.000Z',
      false,
      'http://localhost:3000'
    )
    expect(mockBeginSend).not.toHaveBeenCalled()
  })

  it('uses "Reminder" subject when not overdue', async () => {
    await sendReminderNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Farmyard Safety',
      '2026-06-10T00:00:00.000Z',
      false,
      'http://localhost:3000'
    )
    const subject = mockBeginSend.mock.calls[0][0].content.subject as string
    expect(subject).toMatch(/^Reminder:/)
    expect(subject).toContain('Farmyard Safety')
  })

  it('uses "Overdue" subject when overdue', async () => {
    await sendReminderNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Farmyard Safety',
      '2026-06-03T00:00:00.000Z',
      true,
      'http://localhost:3000'
    )
    const subject = mockBeginSend.mock.calls[0][0].content.subject as string
    expect(subject).toMatch(/^Overdue:/)
  })

  it('includes formatted due date in body', async () => {
    await sendReminderNotification(
      [{ email: 'user@test.com', name: 'User' }],
      'Safety Checklist',
      '2026-06-10T00:00:00.000Z',
      false,
      'http://localhost:3000'
    )
    const html = mockBeginSend.mock.calls[0][0].content.html as string
    expect(html).toContain('10/06/2026')
  })

  it('sends one email per recipient', async () => {
    await sendReminderNotification(
      [
        { email: 'u1@test.com', name: 'One' },
        { email: 'u2@test.com', name: 'Two' }
      ],
      'Safety Checklist',
      '2026-06-10T00:00:00.000Z',
      false,
      'http://localhost:3000'
    )
    expect(mockBeginSend).toHaveBeenCalledTimes(2)
  })
})
