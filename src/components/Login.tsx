import { useState, type FormEvent } from 'react'
import type { Member } from '../../shared/types'
import { api, errorText } from '../api'
import { COLORS, PALETTE } from '../colors'

interface CodeCheck {
  members: Member[]
  canCreate: boolean
}

export default function Login({ onDone }: { onDone: (token: string) => void }) {
  const [code, setCode] = useState('')
  const [check, setCheck] = useState<CodeCheck | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const checkCode = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const res = await api<CodeCheck>('/login', 'POST', { code })
      setCheck(res)
      // Propose par défaut une couleur différente de celle de l'autre
      setColor(PALETTE.find((c) => !res.members.some((m) => m.color === c)) ?? PALETTE[0])
    })
  }

  const enter = (asName: string) =>
    run(async () => {
      const res = await api<{ token: string }>('/login', 'POST', { code, name: asName, color })
      onDone(res.token)
    })

  return (
    <div className="login">
      <img src="/icon-192.png" alt="" width="84" height="84" />
      <h1>Calendrier</h1>

      {!check ? (
        <form onSubmit={checkCode}>
          <p className="muted">Entrez le code que vous partagez tous les deux.</p>
          <input type="password" placeholder="Code de couple" aria-label="Code de couple" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" autoFocus />
          <button className="primary" disabled={busy || !code}>
            Continuer
          </button>
        </form>
      ) : (
        <div className="stack">
          {check.members.map((m) => (
            <button key={m.id} className="who" disabled={busy} onClick={() => enter(m.name)}>
              <span className="dot big" style={{ background: m.color }} />
              Je suis {m.name}
            </button>
          ))}
          {check.canCreate && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                enter(name)
              }}
            >
              <p className="muted">{check.members.length ? 'Ou créez votre profil :' : 'Créez votre profil :'}</p>
              <input placeholder="Votre prénom" aria-label="Votre prénom" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
              <div className="swatches">
                {COLORS.map((c) => (
                  <button key={c.hex} type="button" aria-label={c.name} aria-pressed={c.hex === color} className={c.hex === color ? 'swatch on' : 'swatch'} style={{ background: c.hex }} onClick={() => setColor(c.hex)} />
                ))}
              </div>
              <button className="primary" disabled={busy || !name.trim()}>
                Commencer
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
