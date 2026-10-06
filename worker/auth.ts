import { b64url, type Env } from './env'

const enc = new TextEncoder()

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

// Comparer les deux empreintes plutôt que les codes évite de révéler le code par le temps de réponse
export async function codeMatches(env: Env, code: string): Promise<boolean> {
  const secret = env.COUPLE_CODE!
  return (await hmac(secret, 'code:' + code)) === (await hmac(secret, 'code:' + secret))
}

// Le jeton est signé avec le code de couple : changer le code déconnecte tous les téléphones
export async function makeToken(env: Env, memberId: string): Promise<string> {
  return `${memberId}.${await hmac(env.COUPLE_CODE!, 'member:' + memberId)}`
}

export async function verifyToken(env: Env, token: string): Promise<string | null> {
  if (!env.COUPLE_CODE) return null
  const i = token.lastIndexOf('.')
  if (i < 1) return null
  const memberId = token.slice(0, i)
  return (await makeToken(env, memberId)) === token ? memberId : null
}
