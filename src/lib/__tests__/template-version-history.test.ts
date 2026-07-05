import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTemplateVersionHistoryEntry,
  getTemplateVersionHistory
} from '../template-version-history'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    templateVersionHistory: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_ENTRY = {
  id: 'history_123',
  templateId: 'template_123',
  version: 1,
  changeReason: 'New COSHH regulation April 2026',
  snapshot: {
    title: 'Farmyard Safety Checklist',
    description: 'Annual review',
    formSchema: null,
    questions: null
  },
  publishedAt: new Date('2024-01-01T00:00:00.000Z'),
  publishedBy: 'user_1'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTemplateVersionHistoryEntry', () => {
  it('creates and returns the new history entry', async () => {
    mockPrisma.templateVersionHistory.create.mockResolvedValue(BASE_ENTRY)

    const result = await createTemplateVersionHistoryEntry({
      templateId: 'template_123',
      version: 1,
      changeReason: 'New COSHH regulation April 2026',
      snapshot: BASE_ENTRY.snapshot,
      publishedBy: 'user_1'
    })

    expect(result).not.toBeNull()
    expect(result?.version).toBe(1)
    expect(result?.changeReason).toBe('New COSHH regulation April 2026')
    expect(result?.snapshot).toEqual(BASE_ENTRY.snapshot)
    expect(result?.publishedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns null on error', async () => {
    mockPrisma.templateVersionHistory.create.mockRejectedValue(
      new Error('db error')
    )

    const result = await createTemplateVersionHistoryEntry({
      templateId: 'template_123',
      version: 1,
      changeReason: null,
      snapshot: BASE_ENTRY.snapshot,
      publishedBy: null
    })

    expect(result).toBeNull()
  })
})

describe('getTemplateVersionHistory', () => {
  it('returns history entries ordered by version desc', async () => {
    mockPrisma.templateVersionHistory.findMany.mockResolvedValue([
      { ...BASE_ENTRY, version: 2, id: 'history_2' },
      BASE_ENTRY
    ])

    const result = await getTemplateVersionHistory('template_123')

    expect(result).toHaveLength(2)
    expect(mockPrisma.templateVersionHistory.findMany).toHaveBeenCalledWith({
      where: { templateId: 'template_123' },
      orderBy: { version: 'desc' }
    })
    expect(result[0].version).toBe(2)
  })

  it('returns empty array on error', async () => {
    mockPrisma.templateVersionHistory.findMany.mockRejectedValue(
      new Error('db error')
    )
    expect(await getTemplateVersionHistory('template_123')).toEqual([])
  })
})
