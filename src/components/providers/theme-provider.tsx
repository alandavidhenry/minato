'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'

import {
  DEFAULT_COLOR_THEME,
  isColorTheme,
  type ColorTheme
} from '@/lib/color-themes'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  readonly children: React.ReactNode
  readonly defaultTheme?: Theme
  readonly storageKey?: string
  readonly defaultColorTheme?: ColorTheme
  readonly colorThemeStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorTheme: ColorTheme
  setColorTheme: (colorTheme: ColorTheme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  colorTheme: DEFAULT_COLOR_THEME,
  setColorTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  defaultColorTheme = DEFAULT_COLOR_THEME,
  colorThemeStorageKey = 'color-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [colorTheme, setColorTheme] = useState<ColorTheme>(defaultColorTheme)

  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey)

    if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
      setTheme(savedTheme as Theme)
    }

    const savedColorTheme = localStorage.getItem(colorThemeStorageKey)

    if (savedColorTheme && isColorTheme(savedColorTheme)) {
      setColorTheme(savedColorTheme)
    }
  }, [storageKey, colorThemeStorageKey])

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  useEffect(() => {
    window.document.documentElement.setAttribute('data-theme', colorTheme)
  }, [colorTheme])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      theme,
      setTheme: (theme: Theme) => {
        localStorage.setItem(storageKey, theme)
        setTheme(theme)
      },
      colorTheme,
      setColorTheme: (colorTheme: ColorTheme) => {
        localStorage.setItem(colorThemeStorageKey, colorTheme)
        setColorTheme(colorTheme)
      }
    }),
    [theme, storageKey, colorTheme, colorThemeStorageKey]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
