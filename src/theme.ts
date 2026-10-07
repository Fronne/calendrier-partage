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

// Dans l'application Android, la page arrive avec cette provenance ; on s'en souvient le temps de la session
const IN_APP_KEY = 'cal.android'
if (document.referrer.startsWith('android-app://app.calendrierpartage')) sessionStorage.setItem(IN_APP_KEY, '1')
// Sert aux styles : le bas de l'écran se fond dans la bande du navigateur (voir styles.css)
if (sessionStorage.getItem(IN_APP_KEY)) document.documentElement.dataset.shell = 'android'

export function setTheme(theme: Theme) {
  if (theme === 'auto') localStorage.removeItem(THEME_KEY)
  else localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
  // La barre du bas du téléphone ne dépend pas du site : l'application Android retient le thème
  // et se rouvre avec les bonnes couleurs (android/…/ThemeActivity.java)
  if (sessionStorage.getItem(IN_APP_KEY)) location.href = `intent://theme/${theme}#Intent;scheme=calendrier;package=app.calendrierpartage;end`
}
