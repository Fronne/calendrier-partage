export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TZ_NAME: string
  VAPID_SUBJECT: string
  COUPLE_CODE?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
}

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
