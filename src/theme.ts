export type Theme = 'auto' | 'light' | 'dark'

const THEME_KEY = 'cal.theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'auto'
}

/** 'auto' suit le réglage clair/sombre du téléphone (voir styles.css). */
export function applyTheme(theme: Theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  if (theme === 'auto') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}
