// src/app/api/customer/files/versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCustomerCompanyById } from '@/lib/customer-companies'
import { getDocumentVersions, parseFileName } from '@/lib/version-manager'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const customerCompanyId = session?.user?.customerCompanyId
  if (!customerCompanyId) {
    return NextResponse.json(
      { error: 'No company associated with this account.' },
      { status: 403 }
    )
  }

  const company = await getCustomerCompanyById(customerCompanyId)
  if (!company?.folderPath) {
    return NextResponse.json(
      { error: 'No file storage configured for your company.' },
      { status: 404 }
    )
  }

  const { searchParams } = new URL(request.url)
  const relativePath = searchParams.get('path') ?? ''

  if (!relativePath || relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

  try {
    const { baseName } = parseFileName(relativePath)
    const fullBaseName = `${company.folderPath}/${baseName}`

    const versions = await getDocumentVersions(
      fullBaseName,
      containerName,
      connectionString
    )

    const prefix = `${company.folderPath}/`
    const result = versions.map((v) => ({
      fileName: v.fileName.startsWith(prefix)
        ? v.fileName.slice(prefix.length)
        : v.fileName,
      versionNumber: v.versionNumber,
      uploadedAt: v.uploadedAt.toLocaleDateString()
    }))

    return NextResponse.json({
      totalVersions: result.length,
      versions: result
    })
  } catch (error) {
    console.error('Error fetching customer file versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch versions.' },
      { status: 500 }
    )
  }
}
