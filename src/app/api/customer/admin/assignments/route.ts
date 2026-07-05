import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import {
  createAssignment,
  enrollMatchingUsersForAssignment,
  getAssignmentByTemplateAndCompany,
  getAssignmentsForCompany
} from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { sendAssignmentNotification } from '@/lib/email'
import { getUsersByCompany, resolveEmailRecipients } from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

export async function GET() {
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
    const assignments = await getAssignmentsForCompany(companyId)
    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching company assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { templateId, dueDate, targetJobRoles, autoEnroll } = body as {
      templateId?: string
      dueDate?: string
      targetJobRoles?: string[]
      autoEnroll?: boolean
    }

    if (!templateId) {
      return NextResponse.json(
        { error: 'Missing required field: templateId' },
        { status: 400 }
      )
    }

    // Company admins may only assign templates their own company created
    const template = await getDocumentTemplateById(templateId)
    if (!template || template.ownerCompanyId !== companyId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }
    const currentVersion = template.version

    const existing = await getAssignmentByTemplateAndCompany(
      templateId,
      companyId,
      currentVersion
    )
    if (existing) {
      return NextResponse.json(
        { error: 'Template is already assigned to this company' },
        { status: 409 }
      )
    }

    const assignment = await createAssignment({
      templateId,
      customerCompanyId: companyId,
      dueDate,
      targetJobRoles,
      templateVersion: currentVersion,
      autoEnroll
    })

    if (!assignment) {
      return NextResponse.json(
        { error: 'Failed to create assignment' },
        { status: 500 }
      )
    }

    if (assignment.autoEnroll) {
      await enrollMatchingUsersForAssignment(assignment)
    }

    // Fire-and-forget — email errors must not affect the API response
    const roles = targetJobRoles ?? null
    Promise.resolve()
      .then(async () => {
        const users = await getUsersByCompany(companyId).then((list) =>
          list.filter((u) => {
            if (!roles || roles.length === 0) return true
            if (!u.jobRole) return true
            return roles.includes(u.jobRole)
          })
        )
        if (users.length === 0) return
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
    console.error('Error creating company assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}
