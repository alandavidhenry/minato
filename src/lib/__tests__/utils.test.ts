import { describe, expect, it } from 'vitest'

import { cn } from '../utils'

describe('cn', () => {
  it('joins simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resolves Tailwind conflicts, keeping the last value', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, 'baz')).toBe('foo baz')
  })

  it('handles conditional class objects', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold')
  })

  it('returns empty string when no truthy inputs', () => {
    expect(cn(undefined, undefined)).toBe('')
  })
})
