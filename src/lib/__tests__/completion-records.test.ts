import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCompletionRecord,
  getAssignmentStatusSummary,
  getCompaniesWithCompletions,
  getCompletionGroupsByCompany,
  getCompletionsForAssignmentForAdmin,
  getCompletionsForUser,
  updateCompletionSubmission
} from '../completion-records'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    completionRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    customerCompany: {
      findMany: vi.fn()
    },
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
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
  formData: null,
  submittedBlobPath: null,
  submittedOriginalBlobPath: null,
  submittedFileName: null
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

const BASE_RECORD_WITH_SIGNER = {
  ...BASE_RECORD,
  signedBy: {
    id: 'user_123',
    displayName: 'Jane Smith',
    email: 'jane@example.com'
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.user.count.mockResolvedValue(0)
  mockPrisma.user.findMany.mockResolvedValue([])
  mockPrisma.user.findUnique.mockResolvedValue(null)
  mockPrisma.assignment.findUnique.mockResolvedValue(null)
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

  it('passes submission fields when provided (fill-and-return)', async () => {
    mockPrisma.completionRecord.create.mockResolvedValue({
      ...BASE_RECORD,
      submittedBlobPath: 'form-submissions/assignment_123/user_123/filled.pdf',
      submittedOriginalBlobPath:
        'form-submissions/assignment_123/user_123/filled-original.docx',
      submittedFileName: 'Fire Safety Policy - completed.docx'
    })

    const result = await createCompletionRecord({
      assignmentId: 'assignment_123',
      signedById: 'user_123',
      submittedBlobPath: 'form-submissions/assignment_123/user_123/filled.pdf',
      submittedOriginalBlobPath:
        'form-submissions/assignment_123/user_123/filled-original.docx',
      submittedFileName: 'Fire Safety Policy - completed.docx'
    })

    expect(mockPrisma.completionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submittedBlobPath:
          'form-submissions/assignment_123/user_123/filled.pdf',
        submittedOriginalBlobPath:
          'form-submissions/assignment_123/user_123/filled-original.docx',
        submittedFileName: 'Fire Safety Policy - completed.docx'
      })
    })
    expect(result?.submittedFileName).toBe(
      'Fire Safety Policy - completed.docx'
    )
  })
})

describe('updateCompletionSubmission', () => {
  it('updates the submission fields and returns true', async () => {
    mockPrisma.completionRecord.update.mockResolvedValue(BASE_RECORD)

    const result = await updateCompletionSubmission('record_123', {
      submittedBlobPath: 'form-submissions/assignment_123/user_123/filled.pdf',
      submittedOriginalBlobPath:
        'form-submissions/assignment_123/user_123/filled-original.docx',
      submittedFileName: 'Fire Safety Policy - completed.docx'
    })

    expect(result).toBe(true)
    expect(mockPrisma.completionRecord.update).toHaveBeenCalledWith({
      where: { id: 'record_123' },
      data: {
        submittedBlobPath:
          'form-submissions/assignment_123/user_123/filled.pdf',
        submittedOriginalBlobPath:
          'form-submissions/assignment_123/user_123/filled-original.docx',
        submittedFileName: 'Fire Safety Policy - completed.docx'
      }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.completionRecord.update.mockRejectedValue(new Error('not found'))
    expect(
      await updateCompletionSubmission('missing', {
        submittedBlobPath: 'x',
        submittedOriginalBlobPath: 'y',
        submittedFileName: 'z'
      })
    ).toBe(false)
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

describe('getCompaniesWithCompletions', () => {
  it('returns companies with summed completion counts', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([
      {
        id: 'company_123',
        name: 'Acme Farm',
        assignments: [
          { _count: { completions: 2 } },
          { _count: { completions: 1 } }
        ]
      }
    ])

    const result = await getCompaniesWithCompletions()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Acme Farm')
    expect(result[0].completionCount).toBe(3)
  })

  it('returns empty array on error', async () => {
    mockPrisma.customerCompany.findMany.mockRejectedValue(new Error('db error'))
    expect(await getCompaniesWithCompletions()).toEqual([])
  })
})

describe('getCompletionGroupsByCompany', () => {
  it('returns all assignments with completion counts, due dates, and outstanding counts', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      {
        id: 'assignment_123',
        userId: null,
        dueDate: null,
        template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
        _count: { completions: 2 },
        completions: [{ signedAt: new Date('2024-06-01T00:00:00.000Z') }]
      }
    ])
    mockPrisma.user.count.mockResolvedValue(3)

    const result = await getCompletionGroupsByCompany('company_123')

    expect(result).toHaveLength(1)
    expect(result[0].assignmentId).toBe('assignment_123')
    expect(result[0].template.title).toBe('Farmyard Safety Checklist')
    expect(result[0].completionCount).toBe(2)
    expect(result[0].lastCompletedAt).toBe('2024-06-01T00:00:00.000Z')
    expect(result[0].dueDate).toBeNull()
    expect(result[0].isOverdue).toBe(false)
    expect(result[0].outstandingCount).toBe(1) // 3 users - 2 completions
  })

  it('marks an assignment as overdue when past due date with outstanding users', async () => {
    const pastDate = new Date('2020-01-01T00:00:00.000Z')
    mockPrisma.assignment.findMany.mockResolvedValue([
      {
        id: 'assignment_123',
        userId: null,
        dueDate: pastDate,
        template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
        _count: { completions: 0 },
        completions: []
      }
    ])
    mockPrisma.user.count.mockResolvedValue(2)

    const result = await getCompletionGroupsByCompany('company_123')

    expect(result[0].isOverdue).toBe(true)
    expect(result[0].outstandingCount).toBe(2)
    expect(result[0].lastCompletedAt).toBeNull()
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(await getCompletionGroupsByCompany('company_123')).toEqual([])
  })
})

describe('getCompletionsForAssignmentForAdmin', () => {
  it('returns completions with signer info', async () => {
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      BASE_RECORD_WITH_SIGNER
    ])

    const result = await getCompletionsForAssignmentForAdmin('assignment_123')

    expect(result).toHaveLength(1)
    expect(result[0].signer.displayName).toBe('Jane Smith')
    expect(result[0].signer.email).toBe('jane@example.com')
    expect(result[0].signedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns empty array on error', async () => {
    mockPrisma.completionRecord.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getCompletionsForAssignmentForAdmin('assignment_123')).toEqual(
      []
    )
  })
})

describe('getAssignmentStatusSummary', () => {
  it('returns null when assignment does not exist', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null)
    expect(await getAssignmentStatusSummary('missing')).toBeNull()
  })

  it('returns completed and outstanding users for a company-wide assignment', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      userId: null,
      customerCompanyId: 'company_123',
      dueDate: null,
      template: { title: 'Farmyard Safety Checklist' }
    })
    mockPrisma.completionRecord.findMany.mockResolvedValue([
      BASE_RECORD_WITH_SIGNER
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user_123', displayName: 'Jane Smith', email: 'jane@example.com' },
      { id: 'user_456', displayName: 'Bob Jones', email: 'bob@example.com' }
    ])

    const result = await getAssignmentStatusSummary('assignment_123')

    expect(result).not.toBeNull()
    expect(result!.templateTitle).toBe('Farmyard Safety Checklist')
    expect(result!.completedRecords).toHaveLength(1)
    expect(result!.completedRecords[0].signer.displayName).toBe('Jane Smith')
    expect(result!.outstandingUsers).toHaveLength(1)
    expect(result!.outstandingUsers[0].displayName).toBe('Bob Jones')
    expect(result!.isOverdue).toBe(false)
    expect(result!.dueDate).toBeNull()
  })

  it('marks as overdue when past due date with outstanding users', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      userId: null,
      customerCompanyId: 'company_123',
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      template: { title: 'Safety Checklist' }
    })
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user_456', displayName: 'Bob Jones', email: 'bob@example.com' }
    ])

    const result = await getAssignmentStatusSummary('assignment_123')

    expect(result!.isOverdue).toBe(true)
    expect(result!.outstandingUsers).toHaveLength(1)
  })

  it('returns outstanding user for an individual assignment not yet completed', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      userId: 'user_456',
      customerCompanyId: 'company_123',
      dueDate: null,
      template: { title: 'Safety Checklist' }
    })
    mockPrisma.completionRecord.findMany.mockResolvedValue([])
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_456',
      displayName: 'Bob Jones',
      email: 'bob@example.com'
    })

    const result = await getAssignmentStatusSummary('assignment_123')

    expect(result!.outstandingUsers).toHaveLength(1)
    expect(result!.outstandingUsers[0].displayName).toBe('Bob Jones')
  })

  it('returns null on error', async () => {
    mockPrisma.assignment.findUnique.mockRejectedValue(new Error('db error'))
    expect(await getAssignmentStatusSummary('assignment_123')).toBeNull()
  })
})
