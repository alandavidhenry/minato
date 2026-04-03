import { describe, expect, it } from 'vitest'

import {
  areRelatedDocuments,
  createVersionedFileName,
  generateVersionId,
  parseFileName
} from '../version-manager'

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
    expect(generateVersionId()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u)
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
