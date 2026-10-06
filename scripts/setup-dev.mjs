// Crée .dev.vars (secrets du serveur local) s'il n'existe pas : code de couple de test + clés VAPID.
// Avec --print-vapid, affiche seulement une nouvelle paire de clés (pour la mise en ligne).
import { webcrypto as crypto } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const pub = await crypto.subtle.exportKey('raw', pair.publicKey)
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64url(pub), privateKey: jwk.d }
}

const keys = await vapidKeys()

if (process.argv.includes('--print-vapid')) {
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`)
} else if (existsSync('.dev.vars')) {
  console.log('.dev.vars existe déjà, rien à faire.')
} else {
  const code = 'local-' + b64url(crypto.getRandomValues(new Uint8Array(6)))
  writeFileSync('.dev.vars', `COUPLE_CODE=${code}\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`)
  console.log('.dev.vars créé (le code de couple de test se trouve dedans).')
}
