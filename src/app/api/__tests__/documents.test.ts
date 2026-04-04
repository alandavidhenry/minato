import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE as deleteDocuments } from '../documents/delete/route'
import { GET as downloadDocument } from '../documents/download/route'
import { POST as moveDocument } from '../documents/move/route'
import { POST as renameDocument } from '../documents/rename/route'
import { GET as shareDocument } from '../documents/share/route'
import { POST as uploadDocument } from '../documents/upload/route'
import { GET as getVersions } from '../documents/versions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockFileManager } = vi.hoisted(() => {
  const mockFileManager = {
    generateDownloadUrl: vi.fn(),
    deleteFile: vi.fn(),
    deleteFolder: vi.fn(),
    renameFile: vi.fn(),
    renameFolder: vi.fn(),
    moveFile: vi.fn(),
    moveFolder: vi.fn()
  }
  return { mockFileManager }
})
vi.mock('@/lib/file-system', () => ({
  getFileManager: vi.fn(() => mockFileManager)
}))

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(),
  ActivityType: {
    UPLOAD: 'upload',
    NEW_VERSION: 'new_version',
    DOWNLOAD: 'download',
    DELETE: 'delete',
    RENAME: 'rename',
    MOVE: 'move'
  }
}))

const { mockBlockBlobClient, mockContainerClient } = vi.hoisted(() => {
  const mockBlockBlobClient = {
    exists: vi.fn(),
    uploadData: vi.fn()
  }
  const mockContainerClient = {
    getBlockBlobClient: vi.fn(() => mockBlockBlobClient)
  }
  return { mockBlockBlobClient, mockContainerClient }
})
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => mockContainerClient)
    }))
  }
}))

const { mockGenerateSasToken } = vi.hoisted(() => ({
  mockGenerateSasToken: vi.fn()
}))
vi.mock('@/lib/storage', () => ({
  generateSasToken: mockGenerateSasToken
}))

const { mockGetDocumentVersions } = vi.hoisted(() => ({
  mockGetDocumentVersions: vi.fn()
}))
vi.mock('@/lib/list-blobs', () => ({
  getDocumentVersions: mockGetDocumentVersions
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_SESSION = {
  user: {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    roles: ['Customer']
  }
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function uploadRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  return new NextRequest(new URL('http://localhost/api/documents/upload'), {
    method: 'POST',
    body: formData
  })
}

const TEST_FILE = new File(['hello world'], 'test.pdf', {
  type: 'application/pdf'
})

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockFileManager.generateDownloadUrl.mockResolvedValue(
    'https://example.com/file.pdf?sas=token'
  )
  mockFileManager.deleteFile.mockResolvedValue({
    success: true,
    message: 'File deleted'
  })
  mockFileManager.deleteFolder.mockResolvedValue({
    success: true,
    message: 'Folder deleted',
    data: { deletedCount: 3 }
  })
  mockFileManager.renameFile.mockResolvedValue({
    success: true,
    message: 'File renamed',
    data: { newPath: 'new-name.pdf' }
  })
  mockFileManager.renameFolder.mockResolvedValue({
    success: true,
    message: 'Folder renamed',
    data: { newPath: 'new-folder' }
  })
  mockFileManager.moveFile.mockResolvedValue({
    success: true,
    message: 'File moved',
    data: {}
  })
  mockFileManager.moveFolder.mockResolvedValue({
    success: true,
    message: 'Folder moved',
    data: {}
  })
  mockBlockBlobClient.exists.mockResolvedValue(false)
  mockBlockBlobClient.uploadData.mockResolvedValue({})
  mockGenerateSasToken.mockResolvedValue(
    'https://storage.example.com/blob?sas=token'
  )
  mockGetDocumentVersions.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// POST /api/documents/upload
// ---------------------------------------------------------------------------

describe('POST /api/documents/upload', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = uploadRequest({ file: TEST_FILE })
    const res = await uploadDocument(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = uploadRequest({})
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/no file/i)
  })

  it('returns 400 when file exceeds 50MB', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest('http://localhost/api/documents/upload', {
      method: 'POST'
    })
    vi.spyOn(req, 'formData').mockResolvedValue({
      get: (key: string) =>
        key === 'file'
          ? ({
              name: 'large.pdf',
              size: 51 * 1024 * 1024,
              type: 'application/pdf',
              arrayBuffer: vi.fn()
            } as unknown as File)
          : null
    } as unknown as FormData)
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/50MB/i)
  })

  it('returns 200 on successful file upload', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = uploadRequest({ file: TEST_FILE })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toMatch(/uploaded successfully/i)
    expect(body.fileName).toBe('test.pdf')
    expect(body.isVersion).toBe(false)
  })

  it('auto-versions the file when the same name already exists', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockBlockBlobClient.exists.mockResolvedValue(true)
    const req = uploadRequest({ file: TEST_FILE })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isVersion).toBe(true)
  })

  it('returns 200 when uploading an explicit new version', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = uploadRequest({
      file: TEST_FILE,
      isNewVersion: 'true',
      originalFileName: 'test.pdf'
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isVersion).toBe(true)
  })

  it('prefixes the file path with the folder when folderPath is provided', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = uploadRequest({ file: TEST_FILE, folderPath: 'clients/acme' })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    expect((await res.json()).fileName).toMatch(/^clients\/acme\//)
  })
})

// ---------------------------------------------------------------------------
// GET /api/documents/download
// ---------------------------------------------------------------------------

describe('GET /api/documents/download', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/documents/download?name=test.pdf'
    )
    const res = await downloadDocument(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when the name param is missing', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest('http://localhost/api/documents/download')
    const res = await downloadDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name is required/i)
  })

  it('returns 404 when the file does not exist', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockFileManager.generateDownloadUrl.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/documents/download?name=missing.pdf'
    )
    const res = await downloadDocument(req)
    expect(res.status).toBe(404)
  })

  it('returns 200 with the download URL', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/download?name=test.pdf'
    )
    const res = await downloadDocument(req)
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe(
      'https://example.com/file.pdf?sas=token'
    )
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/documents/delete
// ---------------------------------------------------------------------------

describe('DELETE /api/documents/delete', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/documents/delete', 'DELETE', {
      items: [{ name: 'test.pdf' }]
    })
    const res = await deleteDocuments(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when no items are specified', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest(
      'http://localhost/api/documents/delete',
      'DELETE',
      {}
    )
    const res = await deleteDocuments(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/no items/i)
  })

  it('returns 200 deleting a file via the items array', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/delete', 'DELETE', {
      items: [{ name: 'test.pdf', isFolder: false }]
    })
    const res = await deleteDocuments(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].success).toBe(true)
    expect(body.results[0].isFolder).toBe(false)
  })

  it('returns 200 deleting a folder via the items array', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/delete', 'DELETE', {
      items: [{ name: 'my-folder', path: 'my-folder', isFolder: true }]
    })
    const res = await deleteDocuments(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].isFolder).toBe(true)
    expect(body.results[0].deletedCount).toBe(3)
  })

  it('returns 200 deleting via the legacy names array', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/delete', 'DELETE', {
      names: ['test.pdf']
    })
    const res = await deleteDocuments(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].success).toBe(true)
  })

  it('returns 200 deleting a single file via query param', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/delete?name=test.pdf',
      {
        method: 'DELETE'
      }
    )
    const res = await deleteDocuments(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.isFolder).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// POST /api/documents/move
// ---------------------------------------------------------------------------

describe('POST /api/documents/move', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/documents/move', 'POST', {
      sourcePath: 'a.pdf',
      targetPath: 'folder/a.pdf'
    })
    const res = await moveDocument(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when source or target path is missing', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/move', 'POST', {
      sourcePath: 'a.pdf'
    })
    const res = await moveDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 200 on successful file move', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/move', 'POST', {
      sourcePath: 'a.pdf',
      targetPath: 'folder/a.pdf',
      isFolder: false
    })
    const res = await moveDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.sourcePath).toBe('a.pdf')
    expect(body.targetPath).toBe('folder/a.pdf')
  })

  it('delegates to moveFolder when isFolder is true', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/move', 'POST', {
      sourcePath: 'old-folder',
      targetPath: 'parent/old-folder',
      isFolder: true
    })
    const res = await moveDocument(req)
    expect(res.status).toBe(200)
    expect(mockFileManager.moveFolder).toHaveBeenCalledWith(
      'old-folder',
      'parent/old-folder',
      'user-1',
      'Alice'
    )
    expect(mockFileManager.moveFile).not.toHaveBeenCalled()
  })

  it('returns 400 when the move operation fails', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockFileManager.moveFile.mockResolvedValue({
      success: false,
      message: 'Target already exists'
    })
    const req = jsonRequest('http://localhost/api/documents/move', 'POST', {
      sourcePath: 'a.pdf',
      targetPath: 'folder/a.pdf'
    })
    const res = await moveDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/target already exists/i)
  })
})

// ---------------------------------------------------------------------------
// POST /api/documents/rename
// ---------------------------------------------------------------------------

describe('POST /api/documents/rename', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/documents/rename', 'POST', {
      path: 'test.pdf',
      newName: 'renamed.pdf'
    })
    const res = await renameDocument(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when path or newName is missing', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/rename', 'POST', {
      path: 'test.pdf'
    })
    const res = await renameDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/required/i)
  })

  it('returns 200 on successful file rename', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/rename', 'POST', {
      path: 'test.pdf',
      newName: 'renamed.pdf',
      isFolder: false
    })
    const res = await renameDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.oldPath).toBe('test.pdf')
    expect(body.newPath).toBe('new-name.pdf')
  })

  it('delegates to renameFolder when isFolder is true', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = jsonRequest('http://localhost/api/documents/rename', 'POST', {
      path: 'old-folder',
      newName: 'new-folder',
      isFolder: true
    })
    const res = await renameDocument(req)
    expect(res.status).toBe(200)
    expect(mockFileManager.renameFolder).toHaveBeenCalledWith(
      'old-folder',
      'new-folder',
      'user-1',
      'Alice'
    )
    expect(mockFileManager.renameFile).not.toHaveBeenCalled()
  })

  it('returns 400 when the rename operation fails', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockFileManager.renameFile.mockResolvedValue({
      success: false,
      message: 'File not found'
    })
    const req = jsonRequest('http://localhost/api/documents/rename', 'POST', {
      path: 'missing.pdf',
      newName: 'renamed.pdf'
    })
    const res = await renameDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/file not found/i)
  })
})

// ---------------------------------------------------------------------------
// GET /api/documents/share
// ---------------------------------------------------------------------------

describe('GET /api/documents/share', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/documents/share?name=test.pdf'
    )
    const res = await shareDocument(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest('http://localhost/api/documents/share')
    const res = await shareDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name is required/i)
  })

  it('returns a viewer URL for PDF files', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/share?name=report.pdf'
    )
    const res = await shareDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.shareUrl).toContain('/shared/view')
    expect(body.shareUrl).toContain(encodeURIComponent('report.pdf'))
  })

  it('returns the SAS URL directly for non-PDF files', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/share?name=data.xlsx'
    )
    const res = await shareDocument(req)
    expect(res.status).toBe(200)
    expect((await res.json()).shareUrl).toBe(
      'https://storage.example.com/blob?sas=token'
    )
  })

  it('defaults to a 7-day expiration when expirationDays is not specified', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/share?name=test.pdf'
    )
    await shareDocument(req)
    const options = mockGenerateSasToken.mock.calls[0][2]
    const diffDays = Math.round(
      (options.expiresOn.getTime() - options.startsOn.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    expect(diffDays).toBe(7)
  })

  it('respects a custom expirationDays parameter', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/share?name=test.pdf&expirationDays=30'
    )
    await shareDocument(req)
    const options = mockGenerateSasToken.mock.calls[0][2]
    const diffDays = Math.round(
      (options.expiresOn.getTime() - options.startsOn.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    expect(diffDays).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// GET /api/documents/versions
// ---------------------------------------------------------------------------

describe('GET /api/documents/versions', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/documents/versions?baseName=report.pdf'
    )
    const res = await getVersions(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when baseName is missing', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest('http://localhost/api/documents/versions')
    const res = await getVersions(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/base name is required/i)
  })

  it('returns 200 with an empty list when no versions exist', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    const req = new NextRequest(
      'http://localhost/api/documents/versions?baseName=report.pdf'
    )
    const res = await getVersions(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.versions).toEqual([])
    expect(body.totalVersions).toBe(0)
  })

  it('returns 200 with formatted version metadata', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockGetDocumentVersions.mockResolvedValue([
      {
        id: 'report-v1.pdf',
        name: 'report-v1.pdf',
        uploadedAt: '4/1/2026',
        type: 'application/pdf',
        size: '102 KB',
        hasVersions: true,
        versionNumber: 1,
        totalVersions: 2
      },
      {
        id: 'report-v2.pdf',
        name: 'report-v2.pdf',
        uploadedAt: '4/4/2026',
        type: 'application/pdf',
        size: '110 KB',
        hasVersions: true,
        versionNumber: 2,
        totalVersions: 2
      }
    ])
    const req = new NextRequest(
      'http://localhost/api/documents/versions?baseName=report.pdf'
    )
    const res = await getVersions(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalVersions).toBe(2)
    expect(body.versions[0].fileName).toBe('report-v1.pdf')
    expect(body.versions[0].versionNumber).toBe(1)
    expect(body.versions[1].fileName).toBe('report-v2.pdf')
    expect(body.versions[1].versionNumber).toBe(2)
  })

  it('returns 500 when fetching versions throws', async () => {
    mockGetServerSession.mockResolvedValue(AUTH_SESSION)
    mockGetDocumentVersions.mockRejectedValue(new Error('Storage unavailable'))
    const req = new NextRequest(
      'http://localhost/api/documents/versions?baseName=report.pdf'
    )
    const res = await getVersions(req)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/failed to fetch/i)
  })
})
