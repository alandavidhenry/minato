import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateSasToken } from '@/lib/storage'
import { UserRole } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  {
    params
  }: { params: Promise<{ assignmentId: string; completionId: string }> }
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
    const { assignmentId, completionId } = await params

    const completion = await prisma.completionRecord.findUnique({
      where: { id: completionId },
      select: {
        blobPath: true,
        assignment: {
          select: { id: true, customerCompanyId: true }
        }
      }
    })

    if (
      !completion ||
      completion.assignment.id !== assignmentId ||
      completion.assignment.customerCompanyId !== companyId
    ) {
      return NextResponse.json(
        { error: 'Completion not found.' },
        { status: 404 }
      )
    }

    if (!completion.blobPath) {
      return NextResponse.json(
        { error: 'PDF not available for this completion.' },
        { status: 404 }
      )
    }

    const url = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      completion.blobPath,
      {
        permissions: 'r',
        contentDisposition: `attachment; filename="completion-${completionId}.pdf"`
      }
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating completion download URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate download link.' },
      { status: 500 }
    )
  }
}
