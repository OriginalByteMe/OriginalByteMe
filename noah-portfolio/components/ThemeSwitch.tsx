'use client'

import { useTheme } from './ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      aria-pressed={theme === 'dark'}
      className="hero-action min-h-11 w-full rounded-full px-4 text-sm font-medium"
    >
      {theme === 'dark' ? <Moon strokeWidth={1.5} className="size-4" aria-hidden /> : <Sun strokeWidth={1.5} className="size-4" aria-hidden />}
      {theme === 'dark' ? 'Dark mode' : 'Light mode'}
    </button>
  )
}
