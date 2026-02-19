'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type FontSize = 'small' | 'medium' | 'large'

interface FontSizeContextType {
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  cycle: () => void
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontSize: 'medium',
  setFontSize: () => {},
  cycle: () => {},
})

export function useFontSize() {
  return useContext(FontSizeContext)
}

const VALID: FontSize[] = ['small', 'medium', 'large']

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium')

  useEffect(() => {
    const stored = localStorage.getItem('fontSize') as FontSize | null
    if (stored && VALID.includes(stored)) {
      setFontSizeState(stored)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [fontSize])

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size)
    localStorage.setItem('fontSize', size)
  }, [])

  const cycle = useCallback(() => {
    const next = VALID[(VALID.indexOf(fontSize) + 1) % VALID.length]
    setFontSize(next)
  }, [fontSize, setFontSize])

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, cycle }}>
      {children}
    </FontSizeContext.Provider>
  )
}
