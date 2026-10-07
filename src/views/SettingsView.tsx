import { useEffect, useRef, useState } from 'react'
import { BOTH, type Member, type SyncData } from '../../shared/types'
import { api, errorText } from '../api'
import { COLORS } from '../colors'
import { todayKey } from '../dates'
import { ZONES } from '../holidays'
import { disablePush, enablePush, isIos, isStandalone, pushEnabled, pushSupported } from '../push'
import { useStore } from '../store'
import { getTheme, setTheme, type Theme } from '../theme'

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
]

interface Props {
  data: SyncData
  zone: string
  onZone: (zone: string) => void
  onLogout: () => void
}

function exportData(data: SyncData) {
  const content = { exported_at: new Date().toISOString(), members: data.members, events: data.events, tasks: data.tasks }
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `calendrier-${todayKey()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SettingsView({ data, zone, onZone, onLogout }: Props) {
  const { me, members, mutate, refresh } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const other = members.find((m) => m.id !== me.id)
  const [name, setName] = useState(me.name)
  const [color, setColor] = useState(me.color)
  const [theme, setThemeState] = useState(getTheme)
  const chooseTheme = (t: Theme) => {
    setTheme(t)
    setThemeState(t)
  }
  const [reminders, setReminders] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pushEnabled().then(setReminders)
  }, [])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMessage('')
    try {
      setMessage((await fn()) ?? '')
    } catch (e) {
      setMessage(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const saveMe = (changes: { name?: string; color?: string; notify_changes?: boolean }) =>
    mutate({ method: 'PUT', path: '/me', body: { name: me.name, color: me.color, notify_changes: me.notify_changes, ...changes } })

  const saveProfile = () =>
    run(async () => {
      await saveMe({ name: name.trim(), color })
      return 'Profil enregistré.'
    })

  const toggleReminders = () =>
    run(async () => {
      if (reminders) await disablePush()
      else await enablePush()
      setReminders(!reminders)
    })

  const test = () =>
    run(async () => {
      const { sent } = await api<{ sent: number }>('/push/test', 'POST')
      return sent ? 'Notification envoyée : elle arrive dans quelques secondes.' : "L'envoi a échoué. Désactivez puis réactivez les notifications."
    })

  const restore = (file: File | undefined) => {
    if (!file) return
    run(async () => {
      let backup: { members?: Member[]; events?: any[]; tasks?: any[] }
      try {
        backup = JSON.parse(await file.text())
      } catch {
        throw new Error("Ce fichier n'est pas une sauvegarde du calendrier.")
      }
      if (!Array.isArray(backup.events) || !Array.isArray(backup.tasks)) throw new Error("Ce fichier n'est pas une sauvegarde du calendrier.")
      // Les identifiants des personnes peuvent avoir changé : on les retrouve par prénom, sinon « nous deux »
      const ownerFor = (old: string) => {
        const name = backup.members?.find((m) => m.id === old)?.name.toLowerCase()
        return members.find((m) => m.id === old || m.name.toLowerCase() === name)?.id ?? BOTH
      }
      const fix = (items: any[]) => items.map((i) => ({ ...i, owner: ownerFor(i.owner) }))
      const res = await api<{ restored: number; already: number; skipped: number }>('/restore', 'POST', { events: fix(backup.events), tasks: fix(backup.tasks) })
      await refresh()
      return `${res.restored} élément(s) restauré(s), ${res.already} déjà présent(s)${res.skipped ? `, ${res.skipped} illisible(s)` : ''}.`
    })
  }

  const shareApp = () =>
    run(async () => {
      const url = window.location.origin
      // Le code de couple ne voyage pas avec le lien : il se donne de vive voix
      if (navigator.share) {
        await navigator.share({ title: 'Calendrier', url }).catch(() => {})
        return
      }
      await navigator.clipboard.writeText(url)
      return 'Adresse copiée.'
    })

  // Sur iPhone, les notifications n'existent que pour une app ajoutée à l'écran d'accueil
  const needsInstall = isIos() && !isStandalone()

  return (
    <div className="settings">
      <section className="card">
        <h2>Mon profil</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Prénom" />
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c.hex} aria-label={c.name} aria-pressed={c.hex === color} className={c.hex === color ? 'swatch on' : 'swatch'} style={{ background: c.hex }} onClick={() => setColor(c.hex)} />
          ))}
        </div>
        <button className="primary" disabled={busy || !name.trim() || (name === me.name && color === me.color)} onClick={saveProfile}>
          Enregistrer
        </button>
      </section>

      {!other && (
        <section className="card">
          <h2>Inviter ma moitié</h2>
          <p className="muted">Vous êtes seul dans ce calendrier pour l'instant. Envoyez l'adresse de l'application, puis donnez votre code de couple de vive voix.</p>
          <button className="primary" disabled={busy} onClick={shareApp}>
            Partager l'adresse
          </button>
        </section>
      )}

      <section className="card">
        <h2>Apparence</h2>
        <div className="segmented">
          {THEMES.map((t) => (
            <button key={t.id} className={t.id === theme ? 'on accent' : ''} aria-pressed={t.id === theme} onClick={() => chooseTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Notifications sur ce téléphone</h2>
        {needsInstall ? (
          <p className="muted">
            Sur iPhone, ouvrez cette page dans Safari, touchez le bouton Partager puis « Sur l'écran d'accueil ». Lancez ensuite l'application depuis son icône
            et revenez ici pour activer les notifications.
          </p>
        ) : !pushSupported() ? (
          <p className="muted">Ce navigateur ne permet pas les notifications.</p>
        ) : (
          <>
            <p className="muted">{reminders ? 'Les notifications sont activées.' : 'Recevez les rappels de vos rendez-vous et tâches.'}</p>
            <button className={reminders ? 'secondary' : 'primary'} disabled={busy} onClick={toggleReminders}>
              {reminders ? 'Désactiver les notifications' : 'Activer les notifications'}
            </button>
            {reminders && (
              <button className="secondary" disabled={busy} onClick={test}>
                Envoyer une notification d'essai
              </button>
            )}
          </>
        )}
        <label className="row">
          <span>Me prévenir quand {other?.name ?? "l'autre"} ajoute, modifie ou supprime quelque chose</span>
          <input
            type="checkbox"
            className="switch"
            checked={me.notify_changes}
            onChange={(e) => run(async () => void (await saveMe({ notify_changes: e.target.checked })))}
          />
        </label>
      </section>

      <section className="card">
        <h2>Jours fériés et vacances scolaires</h2>
        <p className="muted">Les jours fériés sont toujours affichés. Choisissez votre zone pour les vacances.</p>
        <div className="segmented">
          {ZONES.map((z) => (
            <button key={z} className={z === zone ? 'on accent' : ''} aria-pressed={z === zone} onClick={() => onZone(z)}>
              Zone {z}
            </button>
          ))}
          <button className={zone === '' ? 'on accent' : ''} aria-pressed={zone === ''} onClick={() => onZone('')}>
            Aucune
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Sauvegarde</h2>
        <p className="muted">Télécharge un fichier contenant tous vos rendez-vous et toutes vos tâches.</p>
        <button className="secondary" onClick={() => exportData(data)}>
          Exporter mes données
        </button>
        <p className="muted">Restaurer remet ce qui manque à partir d'un fichier exporté, sans rien écraser ni supprimer.</p>
        <button className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          Restaurer une sauvegarde
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            restore(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </section>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <button className="danger" onClick={onLogout}>
        Se déconnecter
      </button>
    </div>
  )
}
