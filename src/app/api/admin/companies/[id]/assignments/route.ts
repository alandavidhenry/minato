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
import {
  getUserById,
  getUsersByCompany,
  resolveEmailRecipients
} from '@/lib/user-database'
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

    // Fetch template early to get current version for duplicate check + creation
    const template = await getDocumentTemplateById(templateId)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }
    const currentVersion = template.version

    if (userId) {
      // Individual assignment: check for duplicate per user at current version
      const existing = await getAssignmentByTemplateAndUser(
        templateId,
        userId,
        currentVersion
      )
      if (existing) {
        return NextResponse.json(
          { error: 'Template is already assigned to this user' },
          { status: 409 }
        )
      }
    } else {
      // Company-wide assignment: check for duplicate per company at current version
      const existing = await getAssignmentByTemplateAndCompany(
        templateId,
        customerCompanyId,
        currentVersion
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
      targetJobRoles,
      templateVersion: currentVersion
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'Failed to create assignment' },
        { status: 500 }
      )
    }

    // Fire-and-forget — email errors must not affect the API response
    const roles = targetJobRoles ?? null
    Promise.resolve()
      .then(async () => {
        const users = userId
          ? await getUserById(userId).then((u) => (u ? [u] : []))
          : await getUsersByCompany(customerCompanyId).then((list) =>
              list.filter((u) => {
                if (!roles || roles.length === 0) return true
                if (!u.jobRole) return true
                return roles.includes(u.jobRole)
              })
            )
        if (users.length === 0) return
        // Route no-email users to their line manager; deduplicate by email
        const recipients = await resolveEmailRecipients(users)
        if (recipients.length === 0) return
        return sendAssignmentNotification(
          recipients,
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
