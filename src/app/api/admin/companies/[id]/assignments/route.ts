// src/app/api/admin/companies/[id]/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import {
  createAssignment,
  getAssignmentByTemplateAndCompany,
  getAssignmentByTemplateAndUser,
  getAssignmentsForCompany
} from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { sendAssignmentNotification } from '@/lib/email'
import { getUserById, getUsersByCompany } from '@/lib/user-database'
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
    const { id: customerCompanyId } = await params
    const assignments = await getAssignmentsForCompany(customerCompanyId)
    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { id: customerCompanyId } = await params
    const body = await request.json()
    const { templateId, userId, dueDate, targetJobRoles } = body as {
      templateId?: string
      userId?: string
      dueDate?: string
      targetJobRoles?: string[]
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'Missing required field: templateId' },
        { status: 400 }
      )
    }

    if (userId) {
      // Individual assignment: check for duplicate per user
      const existing = await getAssignmentByTemplateAndUser(templateId, userId)
      if (existing) {
        return NextResponse.json(
          { error: 'Template is already assigned to this user' },
          { status: 409 }
        )
      }
    } else {
      // Company-wide assignment: check for duplicate per company
      const existing = await getAssignmentByTemplateAndCompany(
        templateId,
        customerCompanyId
      )
      if (existing) {
        return NextResponse.json(
          { error: 'Template is already assigned to this company' },
          { status: 409 }
        )
      }
    }

    const assignment = await createAssignment({
      templateId,
      customerCompanyId,
      userId,
      dueDate,
      targetJobRoles
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'Failed to create assignment' },
        { status: 500 }
      )
    }

    // Fire-and-forget — email errors must not affect the API response
    const roles = targetJobRoles ?? null
    Promise.all([
      getDocumentTemplateById(templateId),
      userId
        ? getUserById(userId).then((u) => (u ? [u] : []))
        : getUsersByCompany(customerCompanyId).then((users) =>
            users.filter((u) => {
              if (!roles || roles.length === 0) return true
              if (!u.jobRole) return true
              return roles.includes(u.jobRole)
            })
          )
    ])
      .then(([template, recipients]) => {
        if (!template || recipients.length === 0) return
        return sendAssignmentNotification(
          recipients.map((u) => ({ email: u.email, name: u.displayName })),
          template.title,
          assignment.dueDate,
          process.env.NEXTAUTH_URL ?? ''
        )
      })
      .catch((err: unknown) => {
        console.error('Assignment notification error:', err)
      })

    return NextResponse.json({ assignment })
  } catch (error) {
    console.error('Error creating assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}
