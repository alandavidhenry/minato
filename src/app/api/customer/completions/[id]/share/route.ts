// src/app/api/customer/completions/[id]/share/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionById } from '@/lib/completion-records'
import { generateSasToken } from '@/lib/storage'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const expirationDaysParam = request.nextUrl.searchParams.get('expirationDays')
  let expirationDays = 7
  if (expirationDaysParam) {
    const parsed = parseInt(expirationDaysParam)
    if (!isNaN(parsed) && parsed > 0) expirationDays = parsed
  }

  try {
    const { id } = await params
    const completion = await getCompletionById(id)

    if (!completion || completion.signedById !== userId) {
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

    const sasUrl = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      completion.blobPath,
      {
        permissions: 'r',
        startsOn: new Date(Date.now() - 60 * 1000),
        expiresOn: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
        contentDisposition: `inline; filename="completion-${id}.pdf"`
      }
    )

    const shareUrl = `${request.nextUrl.origin}/shared/view?url=${encodeURIComponent(sasUrl)}&name=${encodeURIComponent(`completion-${id}.pdf`)}`

    return NextResponse.json({ shareUrl })
  } catch (error) {
    console.error('Error generating completion share URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate share link.' },
      { status: 500 }
    )
  }
}
