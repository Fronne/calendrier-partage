import { webcrypto } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { b64url, fromB64url, type Env } from './env'
import { sendPush } from './push'

// Node 18 n'expose pas encore `crypto` globalement
if (!globalThis.crypto) vi.stubGlobal('crypto', webcrypto)

const enc = new TextEncoder()
const subtle = webcrypto.subtle

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

afterEach(() => vi.unstubAllGlobals())

it('chiffre un message que le téléphone sait déchiffrer, signé par le serveur', async () => {
  // Clés du serveur (VAPID) et du "téléphone"
  const vapid = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const vapidPublic = new Uint8Array(await subtle.exportKey('raw', vapid.publicKey))
  const phone = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const phonePublic = new Uint8Array(await subtle.exportKey('raw', phone.publicKey))
  const authSecret = webcrypto.getRandomValues(new Uint8Array(16))

  const env = {
    VAPID_PUBLIC_KEY: b64url(vapidPublic),
    VAPID_PRIVATE_KEY: (await subtle.exportKey('jwk', vapid.privateKey)).d,
    VAPID_SUBJECT: 'https://exemple.test',
  } as Env

  let sent: { url: string; init: RequestInit } | undefined
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent = { url, init }
    return new Response(null, { status: 201 })
  })

  const status = await sendPush(
    env,
    { endpoint: 'https://push.exemple.test/abc', p256dh: b64url(phonePublic), auth: b64url(authSecret) },
    { title: 'Dentiste', body: 'À 14:00' },
  )
  expect(status).toBe(201)
  const headers = sent!.init.headers as Record<string, string>
  expect(headers['Content-Encoding']).toBe('aes128gcm')

  // Signature VAPID vérifiable avec la clé publique du serveur
  const [, jwt, k] = headers.Authorization.match(/^vapid t=(.+), k=(.+)$/)!
  expect(k).toBe(env.VAPID_PUBLIC_KEY)
  const [head, payload, sig] = jwt.split('.')
  expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapid.publicKey, fromB64url(sig), enc.encode(`${head}.${payload}`))).toBe(true)
  expect(JSON.parse(new TextDecoder().decode(fromB64url(payload)))).toMatchObject({ aud: 'https://push.exemple.test', sub: 'https://exemple.test' })

  // Déchiffrement côté téléphone (RFC 8291)
  const body = sent!.init.body as Uint8Array
  const salt = body.slice(0, 16)
  const keyLen = body[20]
  const serverPublic = body.slice(21, 21 + keyLen)
  const cipher = body.slice(21 + keyLen)
  const serverKey = await subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: serverKey }, phone.privateKey, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...phonePublic, ...serverPublic])
  const ikm = await hkdf(authSecret, shared, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher))

  expect(plain[plain.length - 1]).toBe(2)
  expect(JSON.parse(new TextDecoder().decode(plain.slice(0, -1)))).toEqual({ title: 'Dentiste', body: 'À 14:00' })
})
