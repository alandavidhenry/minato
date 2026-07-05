import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  getAllDocumentTemplates,
  getDocumentTemplateById,
  publishNewTemplateVersion,
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
    },
    templateVersionHistory: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Farmyard Safety Checklist',
  description: 'Annual farmyard safety review',
  blobPath: null,
  formSchema: null,
  questions: null,
  version: 1,
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

  it('saves questions when provided', async () => {
    const questions = [
      {
        id: 'cq1',
        question: 'What is the evacuation route?',
        options: ['Side exit', 'Main entrance', 'Roof hatch'],
        answer: 'Side exit'
      }
    ]
    mockPrisma.documentTemplate.update.mockResolvedValue(BASE_TEMPLATE)

    await updateDocumentTemplate('template_123', { questions })

    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template_123' },
      data: { questions }
    })
  })

  it('sets questions to DbNull when explicitly nulled', async () => {
    mockPrisma.documentTemplate.update.mockResolvedValue(BASE_TEMPLATE)

    await updateDocumentTemplate('template_123', { questions: null })

    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template_123' },
      data: { questions: 'DbNull' }
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

describe('publishNewTemplateVersion', () => {
  beforeEach(() => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(BASE_TEMPLATE)
    mockPrisma.$transaction.mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops)
    )
  })

  it('increments version and returns updated template', async () => {
    const v2 = { ...BASE_TEMPLATE, version: 2 }
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue(v2)

    const result = await publishNewTemplateVersion('template_123', {
      changeReason: 'New COSHH regulation April 2026'
    })

    expect(result).not.toBeNull()
    expect(result?.version).toBe(2)
    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'template_123' },
        data: expect.objectContaining({ version: { increment: 1 } })
      })
    )
  })

  it('records a history entry snapshotting the pre-existing content', async () => {
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue({
      ...BASE_TEMPLATE,
      version: 2
    })

    await publishNewTemplateVersion('template_123', {
      changeReason: 'New COSHH regulation April 2026',
      publishedBy: 'user_1'
    })

    expect(mockPrisma.templateVersionHistory.create).toHaveBeenCalledWith({
      data: {
        templateId: 'template_123',
        version: 1,
        changeReason: 'New COSHH regulation April 2026',
        snapshot: {
          title: BASE_TEMPLATE.title,
          description: BASE_TEMPLATE.description,
          formSchema: BASE_TEMPLATE.formSchema,
          questions: BASE_TEMPLATE.questions
        },
        publishedBy: 'user_1'
      }
    })
  })

  it('applies content updates alongside version increment', async () => {
    const v2 = { ...BASE_TEMPLATE, version: 2, title: 'Updated Title' }
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue(v2)

    const result = await publishNewTemplateVersion('template_123', {
      changeReason: 'Corrected question wording',
      title: 'Updated Title'
    })

    expect(result?.title).toBe('Updated Title')
    expect(result?.version).toBe(2)
    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: { increment: 1 },
          title: 'Updated Title'
        })
      })
    )
  })

  it('returns null when the template does not exist', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(null)
    expect(
      await publishNewTemplateVersion('missing', { changeReason: 'reason' })
    ).toBeNull()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns null on error', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db error'))
    expect(
      await publishNewTemplateVersion('template_123', {
        changeReason: 'reason'
      })
    ).toBeNull()
  })
})
