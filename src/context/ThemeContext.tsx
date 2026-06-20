import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export const ACCENT_PRESETS = [
  { name: 'Teal',   value: '#00d4aa' },
  { name: 'Red',    value: '#e63946' },
  { name: 'Blue',   value: '#378add' },
  { name: 'Amber',  value: '#f59e0b' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink',   value: '#ec4899' },
]

interface ThemeContextValue {
  accent: string
  setAccent: (color: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<string>(() => {
    return localStorage.getItem('ow_accent') || '#00d4aa'
  })

  const setAccent = (color: string) => {
    setAccentState(color)
    localStorage.setItem('ow_accent', color)
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    // Derive a darker shade for text-on-accent
    document.documentElement.style.setProperty('--accent-ink', darken(accent, 0.7))
    document.documentElement.style.setProperty('--accent-soft', accent + '22')
  }, [accent])

  return (
    <ThemeContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - amount))
  const g = Math.round(((n >> 8) & 255) * (1 - amount))
  const b = Math.round((n & 255) * (1 - amount))
  return `rgb(${r},${g},${b})`
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
