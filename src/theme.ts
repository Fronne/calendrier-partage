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
  syncStatusBar()
}

/** La barre du haut du téléphone prend la couleur de fond de l'app. */
function syncStatusBar() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

// En mode automatique, suit le passage clair/sombre du téléphone
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncStatusBar)

export function setTheme(theme: Theme) {
  if (theme === 'auto') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}
