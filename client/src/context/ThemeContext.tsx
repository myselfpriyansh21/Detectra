import { createContext, useContext, type ReactNode } from 'react'

// Locked to light mode — Detectra is a single-theme platform (no toggle),
// per product direction. `isDark` is kept as a value (always false)
// rather than ripped out everywhere, since most components branch their
// Tailwind classes on it; this way that branching resolves to the light
// styles without touching every component.
interface ThemeContextType {
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false })

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={{ isDark: false }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
