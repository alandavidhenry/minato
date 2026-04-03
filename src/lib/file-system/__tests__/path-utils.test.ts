import { describe, expect, it } from 'vitest'

import {
  FOLDER_MARKER,
  FOLDER_SEPARATOR,
  getFolderMarkerPath,
  isDirectChild,
  isValidName,
  normalizePath
} from '../path-utils'

describe('constants', () => {
  it('FOLDER_SEPARATOR is /', () => {
    expect(FOLDER_SEPARATOR).toBe('/')
  })

  it('FOLDER_MARKER is .folder', () => {
    expect(FOLDER_MARKER).toBe('.folder')
  })
})

describe('normalizePath', () => {
  it('trims leading slashes', () => {
    expect(normalizePath('/foo/bar')).toBe('foo/bar')
  })

  it('trims trailing slashes', () => {
    expect(normalizePath('foo/bar/')).toBe('foo/bar')
  })

  it('trims both ends', () => {
    expect(normalizePath('/foo/bar/')).toBe('foo/bar')
  })

  it('handles multiple leading/trailing slashes', () => {
    expect(normalizePath('///foo/bar///')).toBe('foo/bar')
  })

  it('trims whitespace', () => {
    expect(normalizePath('  foo/bar  ')).toBe('foo/bar')
  })

  it('returns empty string for root-only input', () => {
    expect(normalizePath('/')).toBe('')
  })

  it('leaves a clean path unchanged', () => {
    expect(normalizePath('foo/bar/baz')).toBe('foo/bar/baz')
  })
})

describe('getFolderMarkerPath', () => {
  it('returns .folder for empty path', () => {
    expect(getFolderMarkerPath('')).toBe('.folder')
  })

  it('appends /.folder to a path', () => {
    expect(getFolderMarkerPath('foo/bar')).toBe('foo/bar/.folder')
  })

  it('normalizes the path before appending', () => {
    expect(getFolderMarkerPath('/foo/bar/')).toBe('foo/bar/.folder')
  })
})

describe('isValidName', () => {
  it('accepts a normal name', () => {
    expect(isValidName('My Document')).toBe(true)
  })

  it('accepts alphanumeric with dashes and dots', () => {
    expect(isValidName('report-2024.pdf')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidName('')).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(isValidName('   ')).toBe(false)
  })

  it('rejects names exceeding 255 characters', () => {
    expect(isValidName('a'.repeat(256))).toBe(false)
  })

  it('accepts names of exactly 255 characters', () => {
    expect(isValidName('a'.repeat(255))).toBe(true)
  })

  it.each(['*', '?', ':', '"', ';', '|', '<', '>', '\\'])(
    'rejects invalid character %s',
    (char) => {
      expect(isValidName(`file${char}name`)).toBe(false)
    }
  )
})

describe('isDirectChild', () => {
  describe('root level (empty currentPath)', () => {
    it('returns true for a top-level name', () => {
      expect(isDirectChild('folder1', '')).toBe(true)
    })

    it('returns false for a nested path', () => {
      expect(isDirectChild('folder1/subfolder', '')).toBe(false)
    })
  })

  describe('nested level', () => {
    it('returns true when path is exactly one level deeper', () => {
      expect(isDirectChild('folder1/child', 'folder1')).toBe(true)
    })

    it('returns false when path is two levels deeper', () => {
      expect(isDirectChild('folder1/child/grandchild', 'folder1')).toBe(false)
    })

    it('returns false when path does not start with currentPath', () => {
      expect(isDirectChild('other/child', 'folder1')).toBe(false)
    })

    it('returns false for the same path', () => {
      expect(isDirectChild('folder1', 'folder1')).toBe(false)
    })

    it('works with deeply nested paths', () => {
      expect(isDirectChild('a/b/c/d', 'a/b/c')).toBe(true)
    })
  })
})
