// src/app/api/customer/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCustomerCompanyById } from '@/lib/customer-companies'
import { getFileManager } from '@/lib/file-system'
import { groupDocumentsByVersion } from '@/lib/version-manager'
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
  const subpath = searchParams.get('path') ?? ''
  const cleanSubpath = subpath.replace(/^\/+|\/+$/g, '')

  if (cleanSubpath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  const fullPath = cleanSubpath
    ? `${company.folderPath}/${cleanSubpath}`
    : company.folderPath

  try {
    const fileManager = getFileManager()
    const rawItems = await fileManager.listContent(fullPath)

    const folders = rawItems
      .filter((i) => i.isFolder)
      .map((i) => ({
        name: i.name,
        isFolder: true,
        uploadedAt: i.uploadedAt,
        hasVersions: false
      }))

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!
    const grouped = await groupDocumentsByVersion(
      containerName,
      connectionString,
      fullPath
    )

    const prefix = `${fullPath}/`
    const files = grouped.map((doc) => {
      const blobName = doc.latestVersion.fileName
      const relativeName = blobName.startsWith(prefix)
        ? blobName.slice(prefix.length)
        : blobName
      return {
        name: relativeName,
        isFolder: false,
        size: doc.latestVersion.size,
        uploadedAt: doc.latestVersion.uploadedAt.toLocaleDateString(),
        hasVersions: doc.versions.length > 1,
        versionNumber: doc.latestVersion.versionNumber,
        totalVersions: doc.versions.length,
        originalName: doc.originalName
      }
    })

    return NextResponse.json({ items: [...folders, ...files] })
  } catch (error) {
    console.error('Error listing customer files:', error)
    return NextResponse.json(
      { error: 'Failed to list files.' },
      { status: 500 }
    )
  }
}
