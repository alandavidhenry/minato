import prisma from './prisma'

export interface CustomerCompanyData {
  id: string
  name: string
  tenantId: string | null
  folderPath: string | null
  createdAt: string
}

type PrismaCustomerCompany = {
  id: string
  name: string
  tenantId: string | null
  folderPath?: string | null // optional until Prisma client is regenerated after migration
  createdAt: Date
}

function toCustomerCompanyData(
  company: PrismaCustomerCompany
): CustomerCompanyData {
  return {
    id: company.id,
    name: company.name,
    tenantId: company.tenantId,
    folderPath: company.folderPath ?? null,
    createdAt: company.createdAt.toISOString()
  }
}

export async function createCustomerCompany({
  name,
  tenantId,
  folderPath
}: {
  name: string
  tenantId?: string
  folderPath?: string
}): Promise<CustomerCompanyData | null> {
  try {
    const company = await prisma.customerCompany.create({
      data: { name, tenantId, folderPath }
    })
    return toCustomerCompanyData(company)
  } catch (error) {
    console.error('Error creating customer company:', error)
    return null
  }
}

export async function getAllCustomerCompanies(): Promise<
  CustomerCompanyData[]
> {
  try {
    const companies = await prisma.customerCompany.findMany({
      orderBy: { name: 'asc' }
    })
    return companies.map(toCustomerCompanyData)
  } catch (error) {
    console.error('Error getting customer companies:', error)
    return []
  }
}

export async function getCustomerCompanyById(
  id: string
): Promise<CustomerCompanyData | null> {
  try {
    const company = await prisma.customerCompany.findUnique({ where: { id } })
    if (!company) return null
    return toCustomerCompanyData(company)
  } catch (error) {
    console.error('Error getting customer company:', error)
    return null
  }
}

export async function updateCustomerCompany(
  id: string,
  updates: { name?: string }
): Promise<boolean> {
  try {
    await prisma.customerCompany.update({
      where: { id },
      data: { ...(updates.name !== undefined && { name: updates.name }) }
    })
    return true
  } catch (error) {
    console.error('Error updating customer company:', error)
    return false
  }
}

export async function deleteCustomerCompany(id: string): Promise<boolean> {
  try {
    await prisma.customerCompany.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting customer company:', error)
    return false
  }
}
