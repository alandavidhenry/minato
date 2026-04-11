import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCompletionRecord,
  getCompletionsForAssignment,
  getCompletionsForUser
} from '../completion-records'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    completionRecord: {
      findMany: vi.fn(),
      create: vi.fn()
    }
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_RECORD = {
  id: 'record_123',
  assignmentId: 'assignment_123',
  signedById: 'user_123',
  signedAt: new Date('2024-01-01T00:00:00.000Z'),
  blobPath: null,
  formData: null
}

const BASE_RECORD_WITH_TEMPLATE = {
  ...BASE_RECORD,
  assignment: {
    id: 'assignment_123',
    templateId: 'template_123',
    template: {
      id: 'template_123',
      title: 'Farmyard Safety Checklist',
      description: null
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCompletionRecord', () => {
  it('creates and returns the new record', async () => {
    mockPrisma.completionRecord.create.mockResolvedValue(BASE_RECORD)

    const result = await createCompletionRecord({
      assignmentId: 'assignment_123',
      signedById: 'user_123'
    })

    expect(result).not.toBeNull()
    expect(result?.assignmentId).toBe('assignment_123')
    expect(result?.signedById).toBe('user_123')
    expect(result?.signedAt).toBe('2024-01-01T00:00:00.000Z')
    expect(result?.blobPath).toBeNull()
  })

  it('passes formData when provided', async () => {
    mockPrisma.completionRecord.create.mockResolvedValue({
      ...BASE_RECORD,
      formData: { answer: 'yes' }
    })

    const result = await createCompletionRecord({
      assignmentId: 'assignment_123',
      signedById: 'user_123',
      formData: { answer: 'yes' }
    })

    expect(result?.formData).toEqual({ answer: 'yes' })
  })

  it('returns null on error', async () => {
    mockPrisma.completionRecord.create.mockRejectedValue(new Error('db error'))
    expect(
      await createCompletionRecord({
        assignmentId: 'assignment_123',
        signedById: 'user_123'
      })
    ).toBeNull()
  })
})

describe('getCompletionsForAssignment', () => {
  it('returns completion records for an assignment', async () => {
    mockPrisma.completionRecord.findMany.mockResolvedValue([BASE_RECORD])

    const result = await getCompletionsForAssignment('assignment_123')

    expect(result).toHaveLength(1)
    expect(result[0].signedById).toBe('user_123')
  })

  it('returns empty array on error', async () => {
    mockPrisma.completionRecord.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getCompletionsForAssignment('assignment_123')).toEqual([])
  })
})

describe('getCompletionsForUser', () => {
  it('returns completions with template info', async () => {
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      BASE_RECORD_WITH_TEMPLATE
    ])

    const result = await getCompletionsForUser('user_123')

    expect(result).toHaveLength(1)
    expect(result[0].assignment.template.title).toBe(
      'Farmyard Safety Checklist'
    )
  })

  it('returns empty array on error', async () => {
    mockPrisma.completionRecord.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getCompletionsForUser('user_123')).toEqual([])
  })
})
