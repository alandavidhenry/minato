// src/app/api/admin/companies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  createCustomerCompany,
  getAllCustomerCompanies
} from '@/lib/customer-companies'
import { getFileManager } from '@/lib/file-system'
import { ADMIN_ROLES } from '@/types/rbac'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['''"`]/g, '') // strip apostrophes/quotes rather than turning them into separators
    .replace(/[^a-z0-9]+/g, '-') // replace remaining non-alphanumeric runs with a hyphen
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
}

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function GET() {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const companies = await getAllCustomerCompanies()
    return NextResponse.json({ companies })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { name, tenantId } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    const folderPath = slugify(name)
    const company = await createCustomerCompany({ name, tenantId, folderPath })

    if (!company) {
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // Auto-create the blob folder for this company (best-effort)
    try {
      const fileManager = getFileManager()
      await fileManager.createFolder(
        folderPath,
        session?.user?.id ?? 'system',
        session?.user?.email ?? 'Admin'
      )
    } catch (err) {
      console.warn('Could not auto-create company folder:', err)
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}
