import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAssignment,
  deleteAssignment,
  getAssignmentById,
  getAssignmentByTemplateAndCompany,
  getAssignmentByTemplateAndUser,
  getAssignmentsForCompany,
  getAssignmentsForUser,
  getAssignmentsForUserOnly
} from '../assignments'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    }
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_ASSIGNMENT = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  dueDate: null,
  targetJobRoles: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z')
}

const USER_ASSIGNMENT = {
  id: 'assignment_456',
  templateId: 'template_456',
  customerCompanyId: 'company_123',
  userId: 'user_123',
  dueDate: null,
  targetJobRoles: null,
  createdAt: new Date('2024-01-02T00:00:00.000Z')
}

const BASE_ASSIGNMENT_WITH_TEMPLATE = {
  ...BASE_ASSIGNMENT,
  template: {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: 'Annual farmyard safety review',
    blobPath: null,
    formSchema: null,
    questions: null
  }
}

const USER_ASSIGNMENT_WITH_TEMPLATE = {
  ...USER_ASSIGNMENT,
  template: {
    id: 'template_456',
    title: 'Power Tools Checklist',
    description: null,
    blobPath: null,
    formSchema: null,
    questions: null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAssignment', () => {
  it('creates a company-wide assignment (no userId)', async () => {
    mockPrisma.assignment.create.mockResolvedValue(BASE_ASSIGNMENT)

    const result = await createAssignment({
      templateId: 'template_123',
      customerCompanyId: 'company_123'
    })

    expect(result).not.toBeNull()
    expect(result?.templateId).toBe('template_123')
    expect(result?.customerCompanyId).toBe('company_123')
    expect(result?.userId).toBeNull()
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('creates a user-level assignment with userId', async () => {
    mockPrisma.assignment.create.mockResolvedValue(USER_ASSIGNMENT)

    const result = await createAssignment({
      templateId: 'template_456',
      customerCompanyId: 'company_123',
      userId: 'user_123'
    })

    expect(result?.userId).toBe('user_123')
  })

  it('returns null on error', async () => {
    mockPrisma.assignment.create.mockRejectedValue(new Error('duplicate'))
    expect(
      await createAssignment({
        templateId: 'template_123',
        customerCompanyId: 'company_123'
      })
    ).toBeNull()
  })
})

describe('getAssignmentById', () => {
  it('returns the assignment when found', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(BASE_ASSIGNMENT)
    const result = await getAssignmentById('assignment_123')
    expect(result?.id).toBe('assignment_123')
  })

  it('returns null when not found', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null)
    expect(await getAssignmentById('missing')).toBeNull()
  })
})

describe('getAssignmentByTemplateAndCompany', () => {
  it('returns company-wide assignment when found', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(BASE_ASSIGNMENT)

    const result = await getAssignmentByTemplateAndCompany(
      'template_123',
      'company_123'
    )

    expect(result?.id).toBe('assignment_123')
    expect(result?.userId).toBeNull()
    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledWith({
      where: {
        templateId: 'template_123',
        customerCompanyId: 'company_123',
        userId: null
      }
    })
  })

  it('returns null when not found', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(null)
    expect(
      await getAssignmentByTemplateAndCompany('template_123', 'company_123')
    ).toBeNull()
  })
})

describe('getAssignmentByTemplateAndUser', () => {
  it('returns user assignment when found', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(USER_ASSIGNMENT)

    const result = await getAssignmentByTemplateAndUser(
      'template_456',
      'user_123'
    )

    expect(result?.id).toBe('assignment_456')
    expect(result?.userId).toBe('user_123')
  })

  it('returns null when not found', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(null)
    expect(
      await getAssignmentByTemplateAndUser('template_456', 'user_123')
    ).toBeNull()
  })
})

describe('getAssignmentsForCompany', () => {
  it('returns company-wide assignments with template info', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      BASE_ASSIGNMENT_WITH_TEMPLATE
    ])

    const result = await getAssignmentsForCompany('company_123')

    expect(result).toHaveLength(1)
    expect(result[0].template.title).toBe('Farmyard Safety Checklist')
    expect(result[0].customerCompanyId).toBe('company_123')
    expect(result[0].userId).toBeNull()
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(await getAssignmentsForCompany('company_123')).toEqual([])
  })
})

describe('getAssignmentsForUserOnly', () => {
  it('returns individual assignments for the user', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      USER_ASSIGNMENT_WITH_TEMPLATE
    ])

    const result = await getAssignmentsForUserOnly('user_123')

    expect(result).toHaveLength(1)
    expect(result[0].template.title).toBe('Power Tools Checklist')
    expect(result[0].userId).toBe('user_123')
  })
})

describe('getAssignmentsForUser', () => {
  it('returns company-wide and individual assignments combined', async () => {
    // Promise.all order in getAssignmentsForUser: [companyWide, individual]
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([BASE_ASSIGNMENT_WITH_TEMPLATE]) // company-wide
      .mockResolvedValueOnce([USER_ASSIGNMENT_WITH_TEMPLATE]) // individual

    const result = await getAssignmentsForUser('user_123', 'company_123')

    expect(result).toHaveLength(2)
  })

  it('deduplicates by templateId, individual assignment wins', async () => {
    const overlap = {
      ...USER_ASSIGNMENT_WITH_TEMPLATE,
      templateId: 'template_123', // same template as company-wide
      template: {
        ...USER_ASSIGNMENT_WITH_TEMPLATE.template,
        id: 'template_123'
      }
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([BASE_ASSIGNMENT_WITH_TEMPLATE]) // company-wide
      .mockResolvedValueOnce([overlap]) // individual (same template)

    const result = await getAssignmentsForUser('user_123', 'company_123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('assignment_456') // the individual one wins
  })

  it('filters out company-wide assignments whose targetJobRoles excludes the user', async () => {
    const restricted = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      targetJobRoles: ['Site Manager', 'Supervisor']
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([restricted]) // company-wide with targetJobRoles
      .mockResolvedValueOnce([]) // no individual assignments

    // User has jobRole 'Labourer' — not in targetJobRoles
    const result = await getAssignmentsForUser(
      'user_123',
      'company_123',
      'Labourer'
    )

    expect(result).toHaveLength(0)
  })

  it('includes company-wide assignment when user job role matches targetJobRoles', async () => {
    const restricted = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      targetJobRoles: ['Site Manager', 'Supervisor']
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([restricted])
      .mockResolvedValueOnce([])

    const result = await getAssignmentsForUser(
      'user_123',
      'company_123',
      'Site Manager'
    )

    expect(result).toHaveLength(1)
  })

  it('includes company-wide assignment when targetJobRoles is null (visible to all)', async () => {
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([BASE_ASSIGNMENT_WITH_TEMPLATE]) // targetJobRoles: null
      .mockResolvedValueOnce([])

    const result = await getAssignmentsForUser(
      'user_123',
      'company_123',
      'Labourer'
    )

    expect(result).toHaveLength(1)
  })

  it('includes restricted company-wide assignment when user has no job role', async () => {
    const restricted = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([restricted])
      .mockResolvedValueOnce([])

    // userJobRole = null → sees everything
    const result = await getAssignmentsForUser('user_123', 'company_123', null)

    expect(result).toHaveLength(1)
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(await getAssignmentsForUser('user_123', 'company_123')).toEqual([])
  })
})

describe('deleteAssignment', () => {
  it('deletes and returns true', async () => {
    mockPrisma.assignment.delete.mockResolvedValue(BASE_ASSIGNMENT)
    expect(await deleteAssignment('assignment_123')).toBe(true)
  })

  it('returns false on error', async () => {
    mockPrisma.assignment.delete.mockRejectedValue(new Error('not found'))
    expect(await deleteAssignment('missing')).toBe(false)
  })
})
