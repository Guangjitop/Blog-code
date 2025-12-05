import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'cyberpunk'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  themes: { value: Theme; label: string; icon: string }[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'ocean', label: '海洋蓝', icon: '🌊' },
  { value: 'sunset', label: '日落橙', icon: '🌅' },
  { value: 'forest', label: '森林绿', icon: '🌲' },
  { value: 'cyberpunk', label: '赛博朋克', icon: '💜' },
]

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    return saved && THEMES.some(t => t.value === saved) ? saved : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    // Remove all theme classes
    THEMES.forEach(t => root.classList.remove(t.value))
    // Add current theme class
    root.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

