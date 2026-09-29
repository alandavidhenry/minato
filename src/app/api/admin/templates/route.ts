// src/app/api/admin/templates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  createDocumentTemplate,
  getAllDocumentTemplates
} from '@/lib/document-templates'
import { isValidReviewPeriod } from '@/lib/review-dates'
import { ADMIN_ROLES } from '@/types/rbac'

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

async function getSessionUserId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id
}

export async function GET() {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const templates = await getAllDocumentTemplates()
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const {
      title,
      description,
      blobPath,
      tenantId,
      category,
      sourceType,
      uploadMode,
      sourceDocBlobPath,
      sourceDocOriginalBlobPath,
      sourceDocFileName,
      reviewPeriodMonths
    } = await request.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      )
    }

    if (
      reviewPeriodMonths !== undefined &&
      !isValidReviewPeriod(reviewPeriodMonths)
    ) {
      return NextResponse.json(
        { error: 'reviewPeriodMonths must be a whole number of months, 1-120' },
        { status: 400 }
      )
    }

    const template = await createDocumentTemplate({
      title,
      description,
      blobPath,
      tenantId,
      category,
      sourceType,
      uploadMode,
      sourceDocBlobPath,
      sourceDocOriginalBlobPath,
      sourceDocFileName,
      reviewPeriodMonths,
      // The creator owns the review by default
      reviewOwnerId: await getSessionUserId()
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
