// src/lib/__tests__/color-themes.test.ts
import { describe, expect, it } from 'vitest'

import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  isColorTheme
} from '@/lib/color-themes'

describe('color-themes', () => {
  it('includes the default theme in the registry', () => {
    expect(
      COLOR_THEMES.some((option) => option.id === DEFAULT_COLOR_THEME)
    ).toBe(true)
  })

  it('has a unique id for every theme', () => {
    const ids = COLOR_THEMES.map((option) => option.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('recognises registered theme ids', () => {
    for (const option of COLOR_THEMES) {
      expect(isColorTheme(option.id)).toBe(true)
    }
  })

  it('rejects unregistered theme ids', () => {
    expect(isColorTheme('not-a-real-theme')).toBe(false)
  })
})
