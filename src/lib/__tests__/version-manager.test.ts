import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  areRelatedDocuments,
  createVersionedFileName,
  generateVersionId,
  getDocumentVersions,
  groupDocumentsByVersion,
  parseFileName
} from '../version-manager'

// --- pure function tests (no mocks needed) ---

describe('generateVersionId', () => {
  it('returns a non-empty string', () => {
    expect(generateVersionId()).toBeTruthy()
  })

  it('contains no colons or dots', () => {
    const id = generateVersionId()
    expect(id).not.toMatch(/[:.]/u)
  })

  it('matches the expected ISO-timestamp-derived format', () => {
    // generateVersionId replaces : and . from toISOString(), producing
    // a string like "2024-01-01T00-00-00-000Z"
    expect(generateVersionId()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u
    )
  })
})

describe('parseFileName', () => {
  describe('files without version suffix', () => {
    it('parses a simple file at root', () => {
      expect(parseFileName('report.pdf')).toEqual({
        baseName: 'report',
        versionId: null,
        extension: '.pdf'
      })
    })

    it('parses a file in a folder', () => {
      expect(parseFileName('folder/report.pdf')).toEqual({
        baseName: 'folder/report',
        versionId: null,
        extension: '.pdf'
      })
    })

    it('parses a file with no extension', () => {
      expect(parseFileName('README')).toEqual({
        baseName: 'README',
        versionId: null,
        extension: ''
      })
    })
  })

  describe('files with version suffix', () => {
    it('parses a versioned file at root', () => {
      expect(parseFileName('report_v_2024-01-01T00-00-00-000Z.pdf')).toEqual({
        baseName: 'report',
        versionId: '2024-01-01T00-00-00-000Z',
        extension: '.pdf'
      })
    })

    it('parses a versioned file in a folder', () => {
      expect(
        parseFileName('docs/report_v_2024-01-01T00-00-00-000Z.pdf')
      ).toEqual({
        baseName: 'docs/report',
        versionId: '2024-01-01T00-00-00-000Z',
        extension: '.pdf'
      })
    })

    it('handles nested folders with a versioned file', () => {
      const result = parseFileName(
        'folder/sub/report_v_2024-01-01T00-00-00-000Z.pdf'
      )
      expect(result.baseName).toBe('folder/sub/report')
      expect(result.versionId).toBe('2024-01-01T00-00-00-000Z')
      expect(result.extension).toBe('.pdf')
    })
  })
})

describe('createVersionedFileName', () => {
  it('creates a versioned name for a root file', () => {
    expect(createVersionedFileName('report.pdf', 'v1')).toBe('report_v_v1.pdf')
  })

  it('preserves folder path', () => {
    expect(createVersionedFileName('docs/report.pdf', 'v1')).toBe(
      'docs/report_v_v1.pdf'
    )
  })

  it('strips existing version before adding new one', () => {
    const alreadyVersioned = 'report_v_old.pdf'
    const result = createVersionedFileName(alreadyVersioned, 'new')
    expect(result).toBe('report_v_new.pdf')
  })

  it('works with files that have no extension', () => {
    expect(createVersionedFileName('README', 'v1')).toBe('README_v_v1')
  })
})

describe('areRelatedDocuments', () => {
  it('returns true for same base name at root', () => {
    expect(
      areRelatedDocuments('report.pdf', 'report_v_2024-01-01T00-00-00-000Z.pdf')
    ).toBe(true)
  })

  it('returns true for two different versions', () => {
    expect(
      areRelatedDocuments(
        'report_v_2024-01-01T00-00-00-000Z.pdf',
        'report_v_2024-06-01T00-00-00-000Z.pdf'
      )
    ).toBe(true)
  })

  it('returns false for different file names', () => {
    expect(areRelatedDocuments('report.pdf', 'summary.pdf')).toBe(false)
  })

  it('returns true for files in the same folder', () => {
    expect(
      areRelatedDocuments(
        'docs/report.pdf',
        'docs/report_v_2024-01-01T00-00-00-000Z.pdf'
      )
    ).toBe(true)
  })

  it('returns false for same name in different folders', () => {
    expect(
      areRelatedDocuments('folder1/report.pdf', 'folder2/report.pdf')
    ).toBe(false)
  })
})

// --- Azure-dependent tests ---

const { mockBlobClient, mockContainerClient } = vi.hoisted(() => {
  const mockBlobClient = {
    getProperties: vi.fn()
  }
  const mockContainerClient = {
    getBlobClient: vi.fn(() => mockBlobClient),
    listBlobsFlat: vi.fn()
  }
  return { mockBlobClient, mockContainerClient }
})

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => mockContainerClient)
    }))
  }
}))

function asyncOf<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

const uploadedAt = new Date('2024-06-01T10:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mockBlobClient.getProperties.mockResolvedValue({ lastModified: uploadedAt })
  mockContainerClient.listBlobsFlat.mockReturnValue(asyncOf())
})

describe('groupDocumentsByVersion', () => {
  it('returns an empty array when the folder is empty', async () => {
    const result = await groupDocumentsByVersion('container', 'conn', '')
    expect(result).toEqual([])
  })

  it('groups a single file (no version suffix)', async () => {
    mockContainerClient.listBlobsFlat.mockReturnValue(
      asyncOf({
        name: 'report.pdf',
        properties: { contentLength: 1024 }
      })
    )

    const result = await groupDocumentsByVersion('container', 'conn', '')

    expect(result).toHaveLength(1)
    expect(result[0].originalName).toBe('report.pdf')
    expect(result[0].versions).toHaveLength(1)
    expect(result[0].versions[0].versionNumber).toBe(1)
  })

  it('groups multiple versions of the same document', async () => {
    const v1Date = new Date('2024-01-01T00:00:00.000Z')
    const v2Date = new Date('2024-06-01T00:00:00.000Z')

    mockContainerClient.listBlobsFlat.mockReturnValue(
      asyncOf(
        { name: 'report_v_v1.pdf', properties: { contentLength: 512 } },
        { name: 'report_v_v2.pdf', properties: { contentLength: 1024 } }
      )
    )

    mockBlobClient.getProperties
      .mockResolvedValueOnce({ lastModified: v1Date })
      .mockResolvedValueOnce({ lastModified: v2Date })

    const result = await groupDocumentsByVersion('container', 'conn', '')

    expect(result).toHaveLength(1)
    expect(result[0].versions).toHaveLength(2)
    // latest version should be first (v2)
    expect(result[0].latestVersion.id).toBe('v2')
    expect(result[0].versions[0].versionNumber).toBe(2)
    expect(result[0].versions[1].versionNumber).toBe(1)
  })

  it('skips folder marker blobs', async () => {
    mockContainerClient.listBlobsFlat.mockReturnValue(
      asyncOf({ name: 'docs/.folder', properties: { contentLength: 0 } })
    )

    const result = await groupDocumentsByVersion('container', 'conn', '')
    expect(result).toHaveLength(0)
  })

  it('respects the folderPath prefix when filtering files', async () => {
    mockContainerClient.listBlobsFlat.mockReturnValue(
      asyncOf(
        { name: 'docs/report.pdf', properties: { contentLength: 1024 } },
        { name: 'docs/sub/nested.pdf', properties: { contentLength: 512 } }
      )
    )

    const result = await groupDocumentsByVersion('container', 'conn', 'docs')

    // only 'docs/report.pdf' is a direct child of 'docs'
    expect(result).toHaveLength(1)
    expect(result[0].originalName).toBe('report.pdf')
  })
})

describe('getDocumentVersions', () => {
  it('returns an empty array when there are no matching files', async () => {
    const result = await getDocumentVersions('report', 'container', 'conn')
    expect(result).toEqual([])
  })

  it('returns sorted versions with correct version numbers', async () => {
    const v1Date = new Date('2024-01-01T00:00:00.000Z')
    const v2Date = new Date('2024-06-01T00:00:00.000Z')

    mockContainerClient.listBlobsFlat.mockReturnValue(
      asyncOf(
        { name: 'report_v_v1.pdf', properties: { contentLength: 512 } },
        { name: 'report_v_v2.pdf', properties: { contentLength: 1024 } }
      )
    )

    mockBlobClient.getProperties
      .mockResolvedValueOnce({ lastModified: v1Date })
      .mockResolvedValueOnce({ lastModified: v2Date })

    const versions = await getDocumentVersions('report', 'container', 'conn')

    expect(versions).toHaveLength(2)
    expect(versions[0].versionNumber).toBe(2) // newest first
    expect(versions[1].versionNumber).toBe(1)
  })
})
