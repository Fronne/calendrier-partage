import { api } from './api'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Vrai si l'app est lancée depuis l'écran d'accueil (obligatoire pour les notifications sur iPhone). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

export async function enablePush(): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Les notifications sont bloquées pour cette application. Autorisez-les dans les réglages du téléphone.')
  }
  const reg = await navigator.serviceWorker.ready
  const { key } = await api<{ key: string }>('/push/key')
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource })
  await api('/push/subscribe', 'POST', sub.toJSON())
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api('/push/unsubscribe', 'POST', { endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}
