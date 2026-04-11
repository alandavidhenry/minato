import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCustomerCompany,
  deleteCustomerCompany,
  getAllCustomerCompanies,
  getCustomerCompanyById,
  updateCustomerCompany
} from '../customer-companies'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    customerCompany: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

vi.mock('../prisma', () => ({ default: mockPrisma }))

const BASE_COMPANY = {
  id: 'company_123',
  name: 'Acme Ltd',
  tenantId: null,
  folderPath: 'acme-ltd',
  createdAt: new Date('2024-01-01T00:00:00.000Z')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCustomerCompany', () => {
  it('creates and returns the new company', async () => {
    mockPrisma.customerCompany.create.mockResolvedValue(BASE_COMPANY)

    const result = await createCustomerCompany({
      name: 'Acme Ltd',
      folderPath: 'acme-ltd'
    })

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Acme Ltd')
    expect(result?.folderPath).toBe('acme-ltd')
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns null on error', async () => {
    mockPrisma.customerCompany.create.mockRejectedValue(new Error('db error'))
    expect(await createCustomerCompany({ name: 'Acme Ltd' })).toBeNull()
  })
})

describe('getAllCustomerCompanies', () => {
  it('returns mapped list of companies', async () => {
    mockPrisma.customerCompany.findMany.mockResolvedValue([BASE_COMPANY])

    const result = await getAllCustomerCompanies()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Acme Ltd')
    expect(result[0].id).toBe('company_123')
  })

  it('returns empty array on error', async () => {
    mockPrisma.customerCompany.findMany.mockRejectedValue(new Error('db error'))
    expect(await getAllCustomerCompanies()).toEqual([])
  })
})

describe('getCustomerCompanyById', () => {
  it('returns the company when found', async () => {
    mockPrisma.customerCompany.findUnique.mockResolvedValue(BASE_COMPANY)

    const result = await getCustomerCompanyById('company_123')

    expect(result?.name).toBe('Acme Ltd')
  })

  it('returns null when not found', async () => {
    mockPrisma.customerCompany.findUnique.mockResolvedValue(null)
    expect(await getCustomerCompanyById('missing')).toBeNull()
  })
})

describe('updateCustomerCompany', () => {
  it('updates and returns true', async () => {
    mockPrisma.customerCompany.update.mockResolvedValue({
      ...BASE_COMPANY,
      name: 'Acme Corp'
    })

    const result = await updateCustomerCompany('company_123', {
      name: 'Acme Corp'
    })

    expect(result).toBe(true)
    expect(mockPrisma.customerCompany.update).toHaveBeenCalledWith({
      where: { id: 'company_123' },
      data: { name: 'Acme Corp' }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.customerCompany.update.mockRejectedValue(new Error('not found'))
    expect(await updateCustomerCompany('missing', { name: 'X' })).toBe(false)
  })
})

describe('deleteCustomerCompany', () => {
  it('deletes and returns true', async () => {
    mockPrisma.customerCompany.delete.mockResolvedValue(BASE_COMPANY)

    const result = await deleteCustomerCompany('company_123')

    expect(result).toBe(true)
    expect(mockPrisma.customerCompany.delete).toHaveBeenCalledWith({
      where: { id: 'company_123' }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.customerCompany.delete.mockRejectedValue(new Error('not found'))
    expect(await deleteCustomerCompany('missing')).toBe(false)
  })
})
