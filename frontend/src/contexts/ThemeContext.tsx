import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Sun, Moon, Waves, Sunset, Trees, Sparkles } from 'lucide-react'

export type Theme = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'cyberpunk'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  themes: { value: Theme; label: string; icon: ReactNode }[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEMES: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: '浅色', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: '深色', icon: <Moon className="w-4 h-4" /> },
  { value: 'ocean', label: '海洋蓝', icon: <Waves className="w-4 h-4" /> },
  { value: 'sunset', label: '日落橙', icon: <Sunset className="w-4 h-4" /> },
  { value: 'forest', label: '森林绿', icon: <Trees className="w-4 h-4" /> },
  { value: 'cyberpunk', label: '赛博朋克', icon: <Sparkles className="w-4 h-4" /> },
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

