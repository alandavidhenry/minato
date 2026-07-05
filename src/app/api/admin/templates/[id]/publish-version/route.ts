import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { createAssignmentsForNewVersion } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import {
  getDocumentTemplateById,
  publishNewTemplateVersion
} from '@/lib/document-templates'
import { sendAssignmentNotification } from '@/lib/email'
import {
  getUserById,
  getUsersByCompany,
  resolveEmailRecipients
} from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

async function getAdminSession() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  if (!roles.some((r) => ADMIN_ROLES.includes(r))) return null
  return session
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params

    const existing = await getDocumentTemplateById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const previousVersion = existing.version

    // Parse optional content updates (body may be empty)
    let updates: Record<string, unknown> = {}
    try {
      updates = await request.json()
    } catch {
      // no body is fine
    }

    const changeReason =
      typeof updates.changeReason === 'string'
        ? updates.changeReason.trim()
        : ''
    if (!changeReason) {
      return NextResponse.json(
        { error: 'A reason for the change is required' },
        { status: 400 }
      )
    }

    const template = await publishNewTemplateVersion(id, {
      changeReason,
      publishedBy: session.user.id,
      title: updates.title as string | undefined,
      description: updates.description as string | undefined,
      blobPath: updates.blobPath as string | undefined,
      ...('formSchema' in updates && {
        formSchema: updates.formSchema as never
      }),
      ...('questions' in updates && { questions: updates.questions as never })
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Failed to publish new version' },
        { status: 500 }
      )
    }

    const newVersion = template.version
    const newAssignments = await createAssignmentsForNewVersion(id, newVersion)

    // Fire-and-forget notifications for each new assignment
    Promise.all(
      newAssignments.map(async (assignment) => {
        const roles = Array.isArray(assignment.targetJobRoles)
          ? assignment.targetJobRoles
          : null
        const users = assignment.userId
          ? await getUserById(assignment.userId).then((u) => (u ? [u] : []))
          : await getUsersByCompany(assignment.customerCompanyId).then((list) =>
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
    ).catch((err: unknown) => {
      console.error('Version publish notification error:', err)
    })

    return NextResponse.json({
      template,
      previousVersion,
      newVersion,
      assignmentsCreated: newAssignments.length
    })
  } catch (error) {
    console.error('Error publishing new template version:', error)
    return NextResponse.json(
      { error: 'Failed to publish new template version' },
      { status: 500 }
    )
  }
}
