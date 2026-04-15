import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  getAllDocumentTemplates,
  getDocumentTemplateById,
  updateDocumentTemplate
} from '../document-templates'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    documentTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: 'Annual farmyard safety review',
  blobPath: null,
  tenantId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createDocumentTemplate', () => {
  it('creates and returns the new template', async () => {
    mockPrisma.documentTemplate.create.mockResolvedValue(BASE_TEMPLATE)

    const result = await createDocumentTemplate({
      title: 'Farmyard Safety Checklist',
      description: 'Annual farmyard safety review'
    })

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Farmyard Safety Checklist')
    expect(result?.description).toBe('Annual farmyard safety review')
    expect(result?.blobPath).toBeNull()
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns null on error', async () => {
    mockPrisma.documentTemplate.create.mockRejectedValue(new Error('db error'))
    expect(await createDocumentTemplate({ title: 'X' })).toBeNull()
  })
})

describe('getAllDocumentTemplates', () => {
  it('returns mapped list of templates', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([BASE_TEMPLATE])

    const result = await getAllDocumentTemplates()

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Farmyard Safety Checklist')
  })

  it('returns empty array on error', async () => {
    mockPrisma.documentTemplate.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getAllDocumentTemplates()).toEqual([])
  })
})

describe('getDocumentTemplateById', () => {
  it('returns the template when found', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(BASE_TEMPLATE)
    const result = await getDocumentTemplateById('template_123')
    expect(result?.title).toBe('Farmyard Safety Checklist')
  })

  it('returns null when not found', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(null)
    expect(await getDocumentTemplateById('missing')).toBeNull()
  })
})

describe('updateDocumentTemplate', () => {
  it('updates and returns true', async () => {
    mockPrisma.documentTemplate.update.mockResolvedValue({
      ...BASE_TEMPLATE,
      title: 'Updated Title'
    })

    const result = await updateDocumentTemplate('template_123', {
      title: 'Updated Title'
    })

    expect(result).toBe(true)
    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template_123' },
      data: { title: 'Updated Title' }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.documentTemplate.update.mockRejectedValue(new Error('not found'))
    expect(await updateDocumentTemplate('missing', { title: 'X' })).toBe(false)
  })
})

describe('deleteDocumentTemplate', () => {
  it('deletes and returns true', async () => {
    mockPrisma.documentTemplate.delete.mockResolvedValue(BASE_TEMPLATE)
    expect(await deleteDocumentTemplate('template_123')).toBe(true)
    expect(mockPrisma.documentTemplate.delete).toHaveBeenCalledWith({
      where: { id: 'template_123' }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.documentTemplate.delete.mockRejectedValue(new Error('not found'))
    expect(await deleteDocumentTemplate('missing')).toBe(false)
  })
})
