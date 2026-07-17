import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAssignment,
  createAssignmentsForNewVersion,
  deleteAssignment,
  enrollMatchingUsersForAssignment,
  enrollUserInMatchingAssignments,
  getAssignmentById,
  getAssignmentByTemplateAndCompany,
  getAssignmentByTemplateAndUser,
  getAssignmentsForCompany,
  getAssignmentsForUser,
  getAssignmentsForUserOnly,
  getAssignmentWithTemplate
} from '../assignments'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    user: {
      findMany: vi.fn()
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
  templateVersion: 1,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  autoEnroll: false
}

// AssignmentData shape (string dates) as returned by createAssignment/toAssignmentData —
// used as the input to enrollMatchingUsersForAssignment
const ASSIGNMENT_DATA = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  dueDate: null,
  targetJobRoles: null,
  templateVersion: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  autoEnroll: false
}

const USER_ASSIGNMENT = {
  id: 'assignment_456',
  templateId: 'template_456',
  customerCompanyId: 'company_123',
  userId: 'user_123',
  dueDate: null,
  targetJobRoles: null,
  templateVersion: 1,
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
  autoEnroll: false
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

  it('passes autoEnroll through for a company-wide assignment', async () => {
    mockPrisma.assignment.create.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      autoEnroll: true
    })

    await createAssignment({
      templateId: 'template_123',
      customerCompanyId: 'company_123',
      autoEnroll: true
    })

    expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoEnroll: true })
      })
    )
  })

  it('forces autoEnroll to false for an individual assignment', async () => {
    mockPrisma.assignment.create.mockResolvedValue(USER_ASSIGNMENT)

    await createAssignment({
      templateId: 'template_456',
      customerCompanyId: 'company_123',
      userId: 'user_123',
      autoEnroll: true
    })

    expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoEnroll: false })
      })
    )
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

describe('getAssignmentWithTemplate', () => {
  it('returns null when not found', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null)
    expect(await getAssignmentWithTemplate('missing')).toBeNull()
  })

  it('maps upload-based template fields through', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      template: {
        id: 'template_123',
        title: 'Fire Safety Policy',
        description: null,
        blobPath: null,
        formSchema: null,
        questions: null,
        sourceType: 'upload',
        uploadMode: 'read-only',
        sourceDocBlobPath: 'templates/template_123/source.pdf',
        sourceDocFileName: 'Fire Safety Policy.docx'
      }
    })

    const result = await getAssignmentWithTemplate('assignment_123')

    expect(result?.template.sourceType).toBe('upload')
    expect(result?.template.uploadMode).toBe('read-only')
    expect(result?.template.sourceDocBlobPath).toBe(
      'templates/template_123/source.pdf'
    )
    expect(result?.template.sourceDocFileName).toBe('Fire Safety Policy.docx')
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

  it('includes templateVersion in where clause when provided', async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(BASE_ASSIGNMENT)

    await getAssignmentByTemplateAndCompany('template_123', 'company_123', 2)

    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledWith({
      where: {
        templateId: 'template_123',
        customerCompanyId: 'company_123',
        userId: null,
        templateVersion: 2
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

describe('createAssignmentsForNewVersion', () => {
  it('creates assignments at newVersion for each previous-version scope', async () => {
    const prevAssignments = [
      { ...BASE_ASSIGNMENT, templateVersion: 1 },
      {
        ...BASE_ASSIGNMENT,
        id: 'assignment_789',
        customerCompanyId: 'company_456',
        templateVersion: 1
      }
    ]
    mockPrisma.assignment.findMany.mockResolvedValue(prevAssignments)
    mockPrisma.assignment.create
      .mockResolvedValueOnce({
        ...BASE_ASSIGNMENT,
        id: 'new_1',
        templateVersion: 2
      })
      .mockResolvedValueOnce({
        ...BASE_ASSIGNMENT,
        id: 'new_2',
        customerCompanyId: 'company_456',
        templateVersion: 2
      })

    const result = await createAssignmentsForNewVersion('template_123', 2)

    expect(result).toHaveLength(2)
    expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith({
      where: { templateId: 'template_123', templateVersion: 1 }
    })
    expect(mockPrisma.assignment.create).toHaveBeenCalledTimes(2)
  })

  it('returns empty array when no previous-version assignments exist', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([])

    const result = await createAssignmentsForNewVersion('template_123', 2)

    expect(result).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('new assignments have null dueDate', async () => {
    const prevAssignment = {
      ...BASE_ASSIGNMENT,
      dueDate: new Date('2024-06-01'),
      templateVersion: 1
    }
    mockPrisma.assignment.findMany.mockResolvedValue([prevAssignment])
    mockPrisma.assignment.create.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      templateVersion: 2,
      dueDate: null
    })

    await createAssignmentsForNewVersion('template_123', 2)

    expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: null, templateVersion: 2 })
      })
    )
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(await createAssignmentsForNewVersion('template_123', 2)).toEqual([])
  })
})

describe('getAssignmentsForUser — version-aware deduplication', () => {
  it('shows the highest-version assignment for a template when multiple versions exist', async () => {
    const v1Assignment = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      templateVersion: 1
    }
    const v2Assignment = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      id: 'assignment_v2',
      templateVersion: 2,
      createdAt: new Date('2024-06-01T00:00:00.000Z')
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([v1Assignment, v2Assignment]) // company-wide
      .mockResolvedValueOnce([]) // individual

    const result = await getAssignmentsForUser('user_123', 'company_123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('assignment_v2')
    expect(result[0].templateVersion).toBe(2)
  })

  it('individual assignment at same version beats company-wide', async () => {
    const companyWideV2 = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      id: 'company_v2',
      templateVersion: 2
    }
    const individualV2 = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      id: 'individual_v2',
      userId: 'user_123',
      templateVersion: 2
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([companyWideV2]) // company-wide
      .mockResolvedValueOnce([individualV2]) // individual

    const result = await getAssignmentsForUser('user_123', 'company_123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('individual_v2')
  })

  it('higher-version company-wide beats lower-version individual', async () => {
    const companyWideV2 = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      id: 'company_v2',
      templateVersion: 2
    }
    const individualV1 = {
      ...BASE_ASSIGNMENT_WITH_TEMPLATE,
      id: 'individual_v1',
      userId: 'user_123',
      templateVersion: 1
    }
    mockPrisma.assignment.findMany
      .mockResolvedValueOnce([companyWideV2]) // company-wide
      .mockResolvedValueOnce([individualV1]) // individual

    const result = await getAssignmentsForUser('user_123', 'company_123')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('company_v2')
  })
})

describe('enrollUserInMatchingAssignments', () => {
  it('creates an individual assignment for a matching autoEnroll assignment', async () => {
    const autoEnrollAssignment = {
      ...BASE_ASSIGNMENT,
      autoEnroll: true,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany.mockResolvedValue([autoEnrollAssignment])
    mockPrisma.assignment.findFirst.mockResolvedValue(null) // not already enrolled
    mockPrisma.assignment.create.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      id: 'new_enrollment',
      userId: 'user_123'
    })

    const result = await enrollUserInMatchingAssignments(
      'user_123',
      'company_123',
      'Site Manager'
    )

    expect(result).toHaveLength(1)
    expect(mockPrisma.assignment.create).toHaveBeenCalledWith({
      data: {
        templateId: 'template_123',
        customerCompanyId: 'company_123',
        userId: 'user_123',
        dueDate: null,
        templateVersion: 1,
        autoEnroll: false
      }
    })
  })

  it('skips assignments whose targetJobRoles does not match the user job role', async () => {
    const autoEnrollAssignment = {
      ...BASE_ASSIGNMENT,
      autoEnroll: true,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany.mockResolvedValue([autoEnrollAssignment])

    const result = await enrollUserInMatchingAssignments(
      'user_123',
      'company_123',
      'Labourer'
    )

    expect(result).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('skips a role-restricted assignment when the user has no job role', async () => {
    const autoEnrollAssignment = {
      ...BASE_ASSIGNMENT,
      autoEnroll: true,
      targetJobRoles: ['Site Manager']
    }
    mockPrisma.assignment.findMany.mockResolvedValue([autoEnrollAssignment])

    const result = await enrollUserInMatchingAssignments(
      'user_123',
      'company_123',
      null
    )

    expect(result).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('matches when targetJobRoles is null (applies to all staff)', async () => {
    const autoEnrollAssignment = { ...BASE_ASSIGNMENT, autoEnroll: true }
    mockPrisma.assignment.findMany.mockResolvedValue([autoEnrollAssignment])
    mockPrisma.assignment.findFirst.mockResolvedValue(null)
    mockPrisma.assignment.create.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      userId: 'user_123'
    })

    const result = await enrollUserInMatchingAssignments(
      'user_123',
      'company_123',
      null
    )

    expect(result).toHaveLength(1)
  })

  it('skips a template the user is already individually enrolled in at that version', async () => {
    const autoEnrollAssignment = { ...BASE_ASSIGNMENT, autoEnroll: true }
    mockPrisma.assignment.findMany.mockResolvedValue([autoEnrollAssignment])
    mockPrisma.assignment.findFirst.mockResolvedValue({
      ...USER_ASSIGNMENT,
      templateId: 'template_123'
    })

    const result = await enrollUserInMatchingAssignments(
      'user_123',
      'company_123',
      null
    )

    expect(result).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(
      await enrollUserInMatchingAssignments('user_123', 'company_123', null)
    ).toEqual([])
  })
})

describe('enrollMatchingUsersForAssignment', () => {
  it('creates enrolments for matching users in the company', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user_1', jobRole: 'Site Manager' },
      { id: 'user_2', jobRole: 'Labourer' }
    ])
    mockPrisma.assignment.findFirst.mockResolvedValue(null)
    mockPrisma.assignment.create.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      userId: 'user_1'
    })

    const result = await enrollMatchingUsersForAssignment({
      ...ASSIGNMENT_DATA,
      autoEnroll: true,
      targetJobRoles: ['Site Manager']
    })

    expect(result).toHaveLength(1)
    expect(mockPrisma.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user_1' })
      })
    )
  })

  it('returns empty array immediately when assignment is not autoEnroll', async () => {
    const result = await enrollMatchingUsersForAssignment({
      ...ASSIGNMENT_DATA,
      autoEnroll: false
    })

    expect(result).toEqual([])
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns empty array immediately when assignment is individual (userId set)', async () => {
    const result = await enrollMatchingUsersForAssignment({
      ...ASSIGNMENT_DATA,
      autoEnroll: true,
      userId: 'user_123'
    })

    expect(result).toEqual([])
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('skips users already individually enrolled at that version', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user_1', jobRole: null }
    ])
    mockPrisma.assignment.findFirst.mockResolvedValue(USER_ASSIGNMENT)

    const result = await enrollMatchingUsersForAssignment({
      ...ASSIGNMENT_DATA,
      autoEnroll: true
    })

    expect(result).toEqual([])
    expect(mockPrisma.assignment.create).not.toHaveBeenCalled()
  })

  it('returns empty array on error', async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error('db error'))
    const result = await enrollMatchingUsersForAssignment({
      ...ASSIGNMENT_DATA,
      autoEnroll: true
    })
    expect(result).toEqual([])
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
