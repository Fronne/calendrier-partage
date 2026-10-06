import { b64url, fromB64url, type Env } from './env'

export interface PushSub {
  endpoint: string
  p256dh: string
  auth: string
}

const enc = new TextEncoder()

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

// En-tête d'authentification VAPID (RFC 8292) : un JWT ES256 signé avec la clé privée du serveur
async function vapidHeader(env: Env, endpoint: string): Promise<string> {
  const pub = fromB64url(env.VAPID_PUBLIC_KEY!)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY!,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT,
      }),
    ),
  )
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`))
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${env.VAPID_PUBLIC_KEY}`
}

// Chiffrement du message pour le navigateur destinataire (RFC 8291, encodage aes128gcm)
async function encrypt(sub: PushSub, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromB64url(sub.p256dh)
  const authSecret = fromB64url(sub.auth)
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const localPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(
    // Le runtime attend bien `public` ; seuls les types Workers le nomment autrement
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, local.privateKey, 256),
  )

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, localPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 marque le dernier (et seul) enregistrement
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(payload, new Uint8Array([2]))))

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = localPublic.length
  return concat(header, localPublic, cipher)
}

/** Envoie une notification. Renvoie le code HTTP du service de push (404/410 = abonnement à supprimer). */
export async function sendPush(env: Env, sub: PushSub, message: unknown): Promise<number> {
  const body = await encrypt(sub, enc.encode(JSON.stringify(message)))
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
    },
    body,
  })
  return res.status
}
