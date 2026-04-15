import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAssignment,
  deleteAssignment,
  getAssignmentById,
  getAssignmentByTemplateAndCompany,
  getAssignmentsForCompany
} from '../assignments'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
  createdAt: new Date('2024-01-01T00:00:00.000Z')
}

const BASE_ASSIGNMENT_WITH_TEMPLATE = {
  ...BASE_ASSIGNMENT,
  template: {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: 'Annual farmyard safety review',
    blobPath: null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAssignment', () => {
  it('creates and returns the new assignment', async () => {
    mockPrisma.assignment.create.mockResolvedValue(BASE_ASSIGNMENT)

    const result = await createAssignment({
      templateId: 'template_123',
      customerCompanyId: 'company_123'
    })

    expect(result).not.toBeNull()
    expect(result?.templateId).toBe('template_123')
    expect(result?.customerCompanyId).toBe('company_123')
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z')
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
  it('returns assignment when found', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(BASE_ASSIGNMENT)

    const result = await getAssignmentByTemplateAndCompany(
      'template_123',
      'company_123'
    )

    expect(result?.id).toBe('assignment_123')
    expect(mockPrisma.assignment.findUnique).toHaveBeenCalledWith({
      where: {
        templateId_customerCompanyId: {
          templateId: 'template_123',
          customerCompanyId: 'company_123'
        }
      }
    })
  })

  it('returns null when not found', async () => {
    mockPrisma.assignment.findUnique.mockResolvedValue(null)
    expect(
      await getAssignmentByTemplateAndCompany('template_123', 'company_123')
    ).toBeNull()
  })
})

describe('getAssignmentsForCompany', () => {
  it('returns assignments with template info', async () => {
    mockPrisma.assignment.findMany.mockResolvedValue([
      BASE_ASSIGNMENT_WITH_TEMPLATE
    ])

    const result = await getAssignmentsForCompany('company_123')

    expect(result).toHaveLength(1)
    expect(result[0].template.title).toBe('Farmyard Safety Checklist')
    expect(result[0].customerCompanyId).toBe('company_123')
  })

  it('returns empty array on error', async () => {
    mockPrisma.assignment.findMany.mockRejectedValue(new Error('db error'))
    expect(await getAssignmentsForCompany('company_123')).toEqual([])
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
