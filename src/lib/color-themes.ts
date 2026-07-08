// src/lib/color-themes.ts
// Registry of selectable color themes, applied via a `data-theme` attribute
// on <html> (see ThemeProvider). Adding a theme means adding an entry here
// and a matching [data-theme='id'] block in globals.css.
export type ColorTheme = 'minato' | 'darkmatter'

export interface ColorThemeOption {
  id: ColorTheme
  label: string
}

export const COLOR_THEMES: ColorThemeOption[] = [
  { id: 'minato', label: 'Minato (Default)' },
  { id: 'darkmatter', label: 'Darkmatter' }
]

export const DEFAULT_COLOR_THEME: ColorTheme = 'minato'

export function isColorTheme(value: string): value is ColorTheme {
  return COLOR_THEMES.some((option) => option.id === value)
}
