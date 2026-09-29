import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDocumentTemplate,
  deleteDocumentTemplate,
  getAllDocumentTemplates,
  getDocumentTemplateById,
  getDocumentTemplatesByOwnerCompany,
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
    tenant: { findFirst: vi.fn() },
    customerCompany: { findUnique: vi.fn() },
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
  ownerCompanyId: null,
  category: 'General',
  sourceType: 'form',
  uploadMode: null,
  sourceDocBlobPath: null,
  sourceDocOriginalBlobPath: null,
  sourceDocFileName: null,
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
    expect(result?.sourceType).toBe('form')
    expect(result?.uploadMode).toBeNull()
  })

  it('defaults the review date to 12 months out and stores the owner', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
    mockPrisma.documentTemplate.create.mockResolvedValue(BASE_TEMPLATE)

    await createDocumentTemplate({ title: 'X', reviewOwnerId: 'user_1' })

    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data
    expect(data.reviewOwnerId).toBe('user_1')
    expect(data.reviewDueAt.toISOString()).toBe('2027-09-30T09:00:00.000Z')
    vi.useRealTimers()
  })

  it('uses an explicit review period at creation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
    mockPrisma.documentTemplate.create.mockResolvedValue(BASE_TEMPLATE)

    await createDocumentTemplate({ title: 'X', reviewPeriodMonths: 6 })

    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data
    expect(data.reviewPeriodMonths).toBe(6)
    expect(data.reviewDueAt.toISOString()).toBe('2027-03-30T09:00:00.000Z')
    expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("falls back to the tenant's default review period at creation", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
    mockPrisma.documentTemplate.create.mockResolvedValue(BASE_TEMPLATE)
    mockPrisma.tenant.findFirst.mockResolvedValue({ reviewPeriodMonths: 24 })

    await createDocumentTemplate({ title: 'X' })

    const data = mockPrisma.documentTemplate.create.mock.calls[0][0].data
    expect(data.reviewPeriodMonths).toBe(24)
    expect(data.reviewDueAt.toISOString()).toBe('2028-09-30T09:00:00.000Z')
    vi.useRealTimers()
  })

  it("uses the owning company's tenant default for company templates", async () => {
    mockPrisma.documentTemplate.create.mockResolvedValue(BASE_TEMPLATE)
    mockPrisma.customerCompany.findUnique.mockResolvedValue({
      tenant: { reviewPeriodMonths: 36 }
    })

    await createDocumentTemplate({ title: 'X', ownerCompanyId: 'co_1' })

    expect(
      mockPrisma.documentTemplate.create.mock.calls[0][0].data
        .reviewPeriodMonths
    ).toBe(36)
  })

  it('returns null on error', async () => {
    mockPrisma.documentTemplate.create.mockRejectedValue(new Error('db error'))
    expect(await createDocumentTemplate({ title: 'X' })).toBeNull()
  })

  it('creates an upload-based template with source doc fields', async () => {
    const uploadTemplate = {
      ...BASE_TEMPLATE,
      sourceType: 'upload',
      uploadMode: 'read-only',
      sourceDocBlobPath: 'templates/template_123/v1/source.pdf',
      sourceDocOriginalBlobPath:
        'templates/template_123/v1/source-original.docx',
      sourceDocFileName: 'Fire Safety Policy.docx'
    }
    mockPrisma.documentTemplate.create.mockResolvedValue(uploadTemplate)

    const result = await createDocumentTemplate({
      title: 'Fire Safety Policy',
      sourceType: 'upload',
      uploadMode: 'read-only',
      sourceDocBlobPath: 'templates/template_123/v1/source.pdf',
      sourceDocOriginalBlobPath:
        'templates/template_123/v1/source-original.docx',
      sourceDocFileName: 'Fire Safety Policy.docx'
    })

    expect(mockPrisma.documentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: 'upload',
        uploadMode: 'read-only',
        sourceDocBlobPath: 'templates/template_123/v1/source.pdf',
        sourceDocOriginalBlobPath:
          'templates/template_123/v1/source-original.docx',
        sourceDocFileName: 'Fire Safety Policy.docx'
      })
    })
    expect(result?.sourceType).toBe('upload')
    expect(result?.uploadMode).toBe('read-only')
    expect(result?.sourceDocFileName).toBe('Fire Safety Policy.docx')
  })

  it('passes category through to prisma and the returned template', async () => {
    const coshhTemplate = { ...BASE_TEMPLATE, category: 'COSHH' }
    mockPrisma.documentTemplate.create.mockResolvedValue(coshhTemplate)

    const result = await createDocumentTemplate({
      title: 'COSHH Assessment',
      category: 'COSHH'
    })

    expect(mockPrisma.documentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: 'COSHH' })
    })
    expect(result?.category).toBe('COSHH')
  })
})

describe('getAllDocumentTemplates', () => {
  it('returns mapped list of templates, scoped to the tenant library', async () => {
    mockPrisma.documentTemplate.findMany.mockResolvedValue([BASE_TEMPLATE])

    const result = await getAllDocumentTemplates()

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Farmyard Safety Checklist')
    expect(result[0].category).toBe('General')
    expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerCompanyId: null } })
    )
  })

  it('returns empty array on error', async () => {
    mockPrisma.documentTemplate.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getAllDocumentTemplates()).toEqual([])
  })
})

describe('getDocumentTemplatesByOwnerCompany', () => {
  it('returns mapped list scoped to the owning company', async () => {
    const companyTemplate = { ...BASE_TEMPLATE, ownerCompanyId: 'company_1' }
    mockPrisma.documentTemplate.findMany.mockResolvedValue([companyTemplate])

    const result = await getDocumentTemplatesByOwnerCompany('company_1')

    expect(result).toHaveLength(1)
    expect(result[0].ownerCompanyId).toBe('company_1')
    expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerCompanyId: 'company_1' } })
    )
  })

  it('returns empty array on error', async () => {
    mockPrisma.documentTemplate.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getDocumentTemplatesByOwnerCompany('company_1')).toEqual([])
  })
})

describe('getDocumentTemplateById', () => {
  it('returns the template when found', async () => {
    mockPrisma.documentTemplate.findUnique.mockResolvedValue(BASE_TEMPLATE)
    const result = await getDocumentTemplateById('template_123')
    expect(result?.title).toBe('Farmyard Safety Checklist')
    expect(result?.category).toBe('General')
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

  it('saves category when provided', async () => {
    mockPrisma.documentTemplate.update.mockResolvedValue(BASE_TEMPLATE)

    await updateDocumentTemplate('template_123', { category: 'Fire Safety' })

    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template_123' },
      data: { category: 'Fire Safety' }
    })
  })

  it('saves source doc fields when replacing an uploaded document', async () => {
    mockPrisma.documentTemplate.update.mockResolvedValue(BASE_TEMPLATE)

    await updateDocumentTemplate('template_123', {
      sourceType: 'upload',
      uploadMode: 'fill-and-return',
      sourceDocBlobPath: 'templates/template_123/v2/source.pdf',
      sourceDocOriginalBlobPath:
        'templates/template_123/v2/source-original.docx',
      sourceDocFileName: 'Fire Safety Policy v2.docx'
    })

    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template_123' },
      data: {
        sourceType: 'upload',
        uploadMode: 'fill-and-return',
        sourceDocBlobPath: 'templates/template_123/v2/source.pdf',
        sourceDocOriginalBlobPath:
          'templates/template_123/v2/source-original.docx',
        sourceDocFileName: 'Fire Safety Policy v2.docx'
      }
    })
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

  it('resets the review date using the template review period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
    mockPrisma.documentTemplate.findUnique.mockResolvedValue({
      ...BASE_TEMPLATE,
      reviewPeriodMonths: 6
    })
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue({
      ...BASE_TEMPLATE,
      version: 2
    })

    await publishNewTemplateVersion('template_123', { changeReason: 'x' })

    const data = mockPrisma.documentTemplate.update.mock.calls[0][0].data
    expect(data.reviewDueAt.toISOString()).toBe('2027-03-30T09:00:00.000Z')
    vi.useRealTimers()
  })

  it('resets the review date to 12 months after publishing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'))
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue({
      ...BASE_TEMPLATE,
      version: 2
    })

    await publishNewTemplateVersion('template_123', { changeReason: 'x' })

    const data = mockPrisma.documentTemplate.update.mock.calls[0][0].data
    expect(data.reviewDueAt.toISOString()).toBe('2027-09-30T09:00:00.000Z')
    expect(data.lastReviewedAt.toISOString()).toBe('2026-09-30T09:00:00.000Z')
    vi.useRealTimers()
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
          questions: BASE_TEMPLATE.questions,
          category: BASE_TEMPLATE.category,
          sourceType: BASE_TEMPLATE.sourceType,
          uploadMode: BASE_TEMPLATE.uploadMode,
          sourceDocBlobPath: BASE_TEMPLATE.sourceDocBlobPath,
          sourceDocOriginalBlobPath: BASE_TEMPLATE.sourceDocOriginalBlobPath,
          sourceDocFileName: BASE_TEMPLATE.sourceDocFileName
        },
        publishedBy: 'user_1'
      }
    })
  })

  it('applies source doc updates alongside version increment', async () => {
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue({
      ...BASE_TEMPLATE,
      version: 2,
      sourceDocBlobPath: 'templates/template_123/v2/source.pdf'
    })

    const result = await publishNewTemplateVersion('template_123', {
      changeReason: 'Updated fire safety procedure',
      sourceDocBlobPath: 'templates/template_123/v2/source.pdf',
      sourceDocOriginalBlobPath:
        'templates/template_123/v2/source-original.docx',
      sourceDocFileName: 'Fire Safety Policy v2.docx'
    })

    expect(result?.sourceDocBlobPath).toBe(
      'templates/template_123/v2/source.pdf'
    )
    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceDocBlobPath: 'templates/template_123/v2/source.pdf',
          sourceDocOriginalBlobPath:
            'templates/template_123/v2/source-original.docx',
          sourceDocFileName: 'Fire Safety Policy v2.docx'
        })
      })
    )
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

  it('applies a category update alongside version increment', async () => {
    const v2 = { ...BASE_TEMPLATE, version: 2, category: 'COSHH' }
    mockPrisma.templateVersionHistory.create.mockResolvedValue({})
    mockPrisma.documentTemplate.update.mockResolvedValue(v2)

    const result = await publishNewTemplateVersion('template_123', {
      changeReason: 'Reclassified as COSHH',
      category: 'COSHH'
    })

    expect(result?.category).toBe('COSHH')
    expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: 'COSHH' })
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
