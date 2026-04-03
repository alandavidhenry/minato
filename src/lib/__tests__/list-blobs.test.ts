import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDocumentVersions, listBlobs } from '../list-blobs'

const { mockFileManager, mockGroupDocumentsByVersion, mockGetDocumentVersions } =
  vi.hoisted(() => {
    const mockFileManager = {
      listContent: vi.fn()
    }
    const mockGroupDocumentsByVersion = vi.fn()
    const mockGetDocumentVersions = vi.fn()
    return {
      mockFileManager,
      mockGroupDocumentsByVersion,
      mockGetDocumentVersions
    }
  })

vi.mock('../file-system', () => ({
  getFileManager: vi.fn(() => mockFileManager)
}))

vi.mock('../version-manager', () => ({
  groupDocumentsByVersion: mockGroupDocumentsByVersion,
  getDocumentVersions: mockGetDocumentVersions
}))

const now = new Date('2024-06-01T10:00:00.000Z')

const makeDocWithVersions = (name: string) => ({
  documentId: name,
  originalName: `${name}.pdf`,
  latestVersion: {
    fileName: `${name}.pdf`,
    originalName: `${name}.pdf`,
    uploadedAt: now,
    size: '10 KB',
    sizeBytes: 10240,
    versionNumber: 1,
    id: 'original'
  },
  versions: [
    {
      fileName: `${name}.pdf`,
      originalName: `${name}.pdf`,
      uploadedAt: now,
      size: '10 KB',
      sizeBytes: 10240,
      versionNumber: 1,
      id: 'original'
    }
  ]
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true'
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'documents'
  mockFileManager.listContent.mockResolvedValue([])
  mockGroupDocumentsByVersion.mockResolvedValue([])
  mockGetDocumentVersions.mockResolvedValue([])
})

describe('listBlobs', () => {
  it('returns an empty array when there are no items', async () => {
    const result = await listBlobs()
    expect(result).toEqual([])
  })

  it('returns folder items from listContent', async () => {
    mockFileManager.listContent.mockResolvedValue([
      {
        name: 'Reports',
        fullPath: 'Reports',
        isFolder: true,
        uploadedAt: null,
        type: null,
        size: null
      }
    ])

    const result = await listBlobs()

    const folder = result.find((item) => item.isFolder)
    expect(folder).toBeDefined()
    expect(folder?.name).toBe('Reports')
    expect(folder?.id).toBe('folder:Reports')
  })

  it('returns latest-version file items when includeVersions is false', async () => {
    mockGroupDocumentsByVersion.mockResolvedValue([makeDocWithVersions('report')])

    const result = await listBlobs(false)

    const file = result.find((item) => !item.isFolder)
    expect(file).toBeDefined()
    expect(file?.originalName).toBe('report.pdf')
    expect(file?.hasVersions).toBe(false)
  })

  it('returns all version items when includeVersions is true', async () => {
    const doc = makeDocWithVersions('report')
    doc.versions.push({ ...doc.versions[0], versionNumber: 2, id: 'v2' })
    mockGroupDocumentsByVersion.mockResolvedValue([doc])

    const result = await listBlobs(true)

    const files = result.filter((item) => !item.isFolder)
    expect(files).toHaveLength(2)
    expect(files[0].hasVersions).toBe(true)
  })

  it('detects content type from file extension', async () => {
    const pdfDoc = makeDocWithVersions('report')
    pdfDoc.latestVersion.fileName = 'report.pdf'
    pdfDoc.latestVersion.originalName = 'report.pdf'
    mockGroupDocumentsByVersion.mockResolvedValue([pdfDoc])

    const result = await listBlobs(false)
    const file = result.find((item) => !item.isFolder)
    expect(file?.type).toBe('application/pdf')
  })

  it('throws when listContent fails', async () => {
    mockFileManager.listContent.mockRejectedValue(new Error('Azure error'))
    await expect(listBlobs()).rejects.toThrow('Azure error')
  })
})

describe('getDocumentVersions', () => {
  it('returns an empty array when the document has no versions', async () => {
    const result = await getDocumentVersions('report')
    expect(result).toEqual([])
  })

  it('maps version objects to BlobItem format', async () => {
    mockGetDocumentVersions.mockResolvedValue([
      {
        fileName: 'folder/report.pdf',
        originalName: 'report.pdf',
        uploadedAt: now,
        size: '10 KB',
        sizeBytes: 10240,
        versionNumber: 1,
        id: 'original'
      }
    ])

    const result = await getDocumentVersions('folder/report')

    expect(result).toHaveLength(1)
    expect(result[0].originalName).toBe('report.pdf')
    expect(result[0].versionNumber).toBe(1)
    expect(result[0].path).toBe('folder')
  })
})
