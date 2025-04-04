// src/hooks/use-media-query.ts
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Set initial state
    const media = window.matchMedia(query)
    setMatches(media.matches)

    // Setup listener
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }
    media.addEventListener('change', listener)

    // Cleanup
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query])

  return matches
}
