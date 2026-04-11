// src/app/api/admin/companies/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  deleteCustomerCompany,
  getCustomerCompanyById,
  updateCustomerCompany
} from '@/lib/customer-companies'
import { getFileManager } from '@/lib/file-system'
import { ADMIN_ROLES } from '@/types/rbac'

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    const company = await getCustomerCompanyById(id)

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    const updates = await request.json()

    const success = await updateCustomerCompany(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    const existing = await getCustomerCompanyById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const success = await deleteCustomerCompany(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot delete company with existing assignments' },
        { status: 409 }
      )
    }

    // Delete the company's blob folder recursively (best-effort)
    if (existing.folderPath) {
      try {
        const fileManager = getFileManager()
        await fileManager.deleteFolder(
          existing.folderPath,
          session?.user?.id ?? 'system',
          session?.user?.email ?? 'Admin'
        )
      } catch (err) {
        console.warn('Could not delete company folder:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}
