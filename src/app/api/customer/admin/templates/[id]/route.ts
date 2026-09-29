import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  deleteDocumentTemplate,
  getDocumentTemplateById,
  updateDocumentTemplate
} from '@/lib/document-templates'
import { isValidReviewPeriod } from '@/lib/review-dates'
import { getUserById } from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

async function getOwnedTemplateOrResponse(id: string, companyId: string) {
  const template = await getDocumentTemplateById(id)
  if (!template || template.ownerCompanyId !== companyId) {
    return {
      template: null,
      response: NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }
  }
  return { template, response: null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { template, response } = await getOwnedTemplateOrResponse(
      id,
      companyId
    )
    if (response) return response

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching company template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { response } = await getOwnedTemplateOrResponse(id, companyId)
    if (response) return response

    const updates = await request.json()

    if (
      updates.reviewPeriodMonths !== undefined &&
      !isValidReviewPeriod(updates.reviewPeriodMonths)
    ) {
      return NextResponse.json(
        { error: 'reviewPeriodMonths must be a whole number of months, 1-120' },
        { status: 400 }
      )
    }
    if (
      updates.reviewDueAt !== undefined &&
      Number.isNaN(new Date(updates.reviewDueAt).getTime())
    ) {
      return NextResponse.json(
        { error: 'reviewDueAt must be a valid date' },
        { status: 400 }
      )
    }
    // The review owner receives the reminder emails, so it must be one of this
    // company's own admins (or null for no owner)
    if (updates.reviewOwnerId) {
      const owner = await getUserById(String(updates.reviewOwnerId))
      if (
        !owner ||
        owner.customerCompanyId !== companyId ||
        owner.role !== UserRole.CUSTOMER_ADMIN
      ) {
        return NextResponse.json(
          { error: 'Review owner must be an admin of your company' },
          { status: 400 }
        )
      }
    }

    const success = await updateDocumentTemplate(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating company template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
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

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { response } = await getOwnedTemplateOrResponse(id, companyId)
    if (response) return response

    const success = await deleteDocumentTemplate(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Cannot delete template with existing assignments' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting company template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
