import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as downloadFile } from '../customer/files/download/route'
import { GET as listFiles } from '../customer/files/route'
import { GET as listVersions } from '../customer/files/versions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetCompanyById } = vi.hoisted(() => ({
  mockGetCompanyById: vi.fn()
}))
vi.mock('@/lib/customer-companies', () => ({
  getCustomerCompanyById: mockGetCompanyById
}))

const { mockListContent, mockGenerateDownloadUrl } = vi.hoisted(() => ({
  mockListContent: vi.fn(),
  mockGenerateDownloadUrl: vi.fn()
}))
vi.mock('@/lib/file-system', () => ({
  getFileManager: () => ({
    listContent: mockListContent,
    generateDownloadUrl: mockGenerateDownloadUrl
  })
}))

const { mockGroupDocumentsByVersion, mockGetDocumentVersions } = vi.hoisted(
  () => ({
    mockGroupDocumentsByVersion: vi.fn(),
    mockGetDocumentVersions: vi.fn()
  })
)
vi.mock('@/lib/version-manager', () => ({
  groupDocumentsByVersion: mockGroupDocumentsByVersion,
  getDocumentVersions: mockGetDocumentVersions,
  parseFileName: (name: string) => {
    const ext =
      name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.')) : ''
    const noExt = ext ? name.slice(0, -ext.length) : name
    const match = /(.+)_v_(.+)$/.exec(noExt)
    return match
      ? { baseName: match[1], versionId: match[2], extension: ext }
      : { baseName: noExt, versionId: null, extension: ext }
  }
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_SESSION = {
  user: {
    id: 'user_123',
    email: 'user@acme.com',
    roles: ['Customer User'],
    customerCompanyId: 'company_123'
  }
}
const NO_COMPANY_SESSION = {
  user: { id: 'user_123', roles: ['Customer User'], customerCompanyId: null }
}
const ADMIN_SESSION = {
  user: { id: 'admin_123', roles: ['Tenant Admin'], customerCompanyId: null }
}

const BASE_COMPANY = {
  id: 'company_123',
  name: 'Acme Ltd',
  tenantId: null,
  folderPath: 'acme-ltd',
  createdAt: '2024-01-01T00:00:00.000Z'
}

const FOLDER_ITEM = { name: 'invoices', isFolder: true }
const FILE_ITEM = {
  name: 'report.pdf',
  path: 'acme-ltd',
  fullPath: 'acme-ltd/report.pdf',
  isFolder: false,
  size: '1.2 MB',
  type: 'application/pdf',
  uploadedAt: '01/01/2024'
}

function getRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCompanyById.mockResolvedValue(BASE_COMPANY)
  mockListContent.mockResolvedValue([])
  mockGenerateDownloadUrl.mockResolvedValue(null)
  mockGroupDocumentsByVersion.mockResolvedValue([])
  mockGetDocumentVersions.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/customer/files
// ---------------------------------------------------------------------------

describe('GET /api/customer/files', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when customer has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when company has no folder path', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompanyById.mockResolvedValue({ ...BASE_COMPANY, folderPath: null })
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for path traversal attempt', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files?path=../other')
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 with items at root', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockListContent.mockResolvedValue([FOLDER_ITEM, FILE_ITEM])
    mockGroupDocumentsByVersion.mockResolvedValue([
      {
        documentId: 'acme-ltd/report',
        originalName: 'report.pdf',
        latestVersion: {
          fileName: 'acme-ltd/report.pdf',
          versionNumber: 1,
          size: '1.2 MB',
          uploadedAt: new Date('2024-01-01')
        },
        versions: [
          {
            fileName: 'acme-ltd/report.pdf',
            versionNumber: 1,
            size: '1.2 MB',
            uploadedAt: new Date('2024-01-01')
          }
        ]
      }
    ])
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2) // 1 folder + 1 grouped file
    expect(mockListContent).toHaveBeenCalledWith('acme-ltd')
    const groupCalls = mockGroupDocumentsByVersion.mock.calls
    expect(groupCalls).toHaveLength(1)
    expect(groupCalls[0][2]).toBe('acme-ltd')
  })

  it('returns 200 with items in subfolder', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockListContent.mockResolvedValue([FILE_ITEM])
    mockGroupDocumentsByVersion.mockResolvedValue([])
    const res = await listFiles(
      getRequest('http://localhost/api/customer/files?path=invoices')
    )
    expect(res.status).toBe(200)
    expect(mockListContent).toHaveBeenCalledWith('acme-ltd/invoices')
    const groupCalls = mockGroupDocumentsByVersion.mock.calls
    expect(groupCalls).toHaveLength(1)
    expect(groupCalls[0][2]).toBe('acme-ltd/invoices')
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/files/download
// ---------------------------------------------------------------------------

describe('GET /api/customer/files/download', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await downloadFile(
      getRequest('http://localhost/api/customer/files/download?path=report.pdf')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when customer has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await downloadFile(
      getRequest('http://localhost/api/customer/files/download?path=report.pdf')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when company has no folder path', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompanyById.mockResolvedValue({ ...BASE_COMPANY, folderPath: null })
    const res = await downloadFile(
      getRequest('http://localhost/api/customer/files/download?path=report.pdf')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when path is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const res = await downloadFile(
      getRequest('http://localhost/api/customer/files/download')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for path traversal attempt', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const res = await downloadFile(
      getRequest(
        'http://localhost/api/customer/files/download?path=../other/secret.pdf'
      )
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 with a download URL', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://blob.example.com/sas-url'
    )
    const res = await downloadFile(
      getRequest('http://localhost/api/customer/files/download?path=report.pdf')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://blob.example.com/sas-url')
    expect(mockGenerateDownloadUrl).toHaveBeenCalledWith('acme-ltd/report.pdf')
  })

  it('returns 200 with URL for file in subfolder', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://blob.example.com/sas-url'
    )
    const res = await downloadFile(
      getRequest(
        'http://localhost/api/customer/files/download?path=invoices/jan.pdf'
      )
    )
    expect(res.status).toBe(200)
    expect(mockGenerateDownloadUrl).toHaveBeenCalledWith(
      'acme-ltd/invoices/jan.pdf'
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/files/versions
// ---------------------------------------------------------------------------

describe('GET /api/customer/files/versions', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions?path=report.pdf')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions?path=report.pdf')
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when customer has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions?path=report.pdf')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when company has no folder path', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetCompanyById.mockResolvedValue({ ...BASE_COMPANY, folderPath: null })
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions?path=report.pdf')
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when path is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for path traversal attempt', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const res = await listVersions(
      getRequest(
        'http://localhost/api/customer/files/versions?path=../other/secret.pdf'
      )
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 with versions, stripping company prefix from filenames', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetDocumentVersions.mockResolvedValue([
      {
        fileName: 'acme-ltd/Completed Forms/report_v_2024-01-02.pdf',
        versionNumber: 2,
        uploadedAt: new Date('2024-01-02')
      },
      {
        fileName: 'acme-ltd/Completed Forms/report_v_2024-01-01.pdf',
        versionNumber: 1,
        uploadedAt: new Date('2024-01-01')
      }
    ])
    const res = await listVersions(
      getRequest(
        'http://localhost/api/customer/files/versions?path=Completed%20Forms%2Freport_v_2024-01-02.pdf'
      )
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalVersions).toBe(2)
    expect(body.versions).toHaveLength(2)
    expect(body.versions[0].fileName).toBe(
      'Completed Forms/report_v_2024-01-02.pdf'
    )
    expect(body.versions[0].versionNumber).toBe(2)
    expect(body.versions[1].fileName).toBe(
      'Completed Forms/report_v_2024-01-01.pdf'
    )
  })

  it('returns 200 with single version when no versioned copies exist', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetDocumentVersions.mockResolvedValue([
      {
        fileName: 'acme-ltd/report.pdf',
        versionNumber: 1,
        uploadedAt: new Date('2024-01-01')
      }
    ])
    const res = await listVersions(
      getRequest('http://localhost/api/customer/files/versions?path=report.pdf')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalVersions).toBe(1)
    expect(body.versions[0].fileName).toBe('report.pdf')
  })
})
