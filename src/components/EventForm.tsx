import { useMemo, useState } from 'react'
import { expand, fmtLocal, parseLocal } from '../../shared/recurrence'
import { BOTH, CATEGORIES, displayTitle, type CalEvent, type Freq, type Occurrence } from '../../shared/types'
import { errorText } from '../api'
import { nextHour } from '../dates'
import { uid } from '../ops'
import { isIos } from '../push'
import { useStore } from '../store'
import OwnerPicker from './OwnerPicker'
import Sheet from './Sheet'

interface Props {
  event?: CalEvent
  /** Occurrence sur laquelle on a appuyé */
  occ?: Occurrence
  /** Jour (et éventuellement heure) proposés pour un nouveau rendez-vous */
  day: string
  time?: string
  onClose: () => void
}

export const REPEATS: { key: string; label: string; freq: Freq; interval: number }[] = [
  { key: 'none', label: 'Jamais', freq: 'none', interval: 1 },
  { key: 'daily', label: 'Tous les jours', freq: 'daily', interval: 1 },
  { key: 'weekly', label: 'Toutes les semaines', freq: 'weekly', interval: 1 },
  { key: 'weekly2', label: 'Toutes les 2 semaines', freq: 'weekly', interval: 2 },
  { key: 'monthly', label: 'Tous les mois', freq: 'monthly', interval: 1 },
  { key: 'yearly', label: 'Tous les ans', freq: 'yearly', interval: 1 },
]

export const repeatKey = (freq: Freq, interval: number) => REPEATS.find((r) => r.freq === freq && r.interval === interval)?.key ?? freq

const REMINDERS_TIMED = [
  { value: '', label: 'Aucun' },
  { value: '0', label: "À l'heure du rendez-vous" },
  { value: '10', label: '10 minutes avant' },
  { value: '30', label: '30 minutes avant' },
  { value: '60', label: '1 heure avant' },
  { value: '1440', label: 'La veille à la même heure' },
]

// Un événement "journée" est rappelé à 9 h (voir reminderBase côté serveur)
export const REMINDERS_ALL_DAY = [
  { value: '', label: 'Aucun' },
  { value: '0', label: 'Le jour même à 9 h' },
  { value: '1440', label: 'La veille à 9 h' },
]

const REMINDERS_BIRTHDAY = [...REMINDERS_ALL_DAY, { value: '4320', label: '3 jours avant' }, { value: '10080', label: '1 semaine avant' }]

/** Chevauchements signalés au maximum dans le formulaire. */
const MAX_CLASHES = 3

const plusOneHour = (local: string) => fmtLocal(new Date(parseLocal(local).getTime() + 3_600_000))

const mapsUrl = (place: string) =>
  (isIos() ? 'https://maps.apple.com/?q=' : 'https://www.google.com/maps/search/?api=1&query=') + encodeURIComponent(place)

export default function EventForm({ event, occ, day, time, onClose }: Props) {
  const { me, members, events, mutate, toast } = useStore()

  // Une date précise d'une série : on peut la modifier seule ou modifier toute la série
  const inSeries = !!event && !!occ && event.rec_freq !== 'none' && event.kind !== 'birthday'
  const [scope, setScope] = useState<'one' | 'series'>('one')
  const one = inSeries && scope === 'one'

  const datesFor = (s: 'one' | 'series') => {
    if (inSeries && s === 'one') return { start: occ!.start, end: occ!.end }
    if (event) return { start: event.start_local, end: event.end_local }
    const start = `${day}T${time ?? nextHour()}`
    return { start, end: plusOneHour(start) }
  }
  const init = datesFor('one')

  const [kind, setKind] = useState(event?.kind ?? 'event')
  const [title, setTitle] = useState(event?.title ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [startDay, setStartDay] = useState(init.start.slice(0, 10))
  const [startTime, setStartTime] = useState(init.start.slice(11) || '09:00')
  const [endDay, setEndDay] = useState(init.end.slice(0, 10))
  const [endTime, setEndTime] = useState(init.end.slice(11) || '10:00')
  const [owner, setOwner] = useState(event?.owner ?? me.id)
  const [category, setCategory] = useState(event?.category ?? '')
  const [repeat, setRepeat] = useState(event ? repeatKey(event.rec_freq, event.rec_interval) : 'none')
  const [until, setUntil] = useState(event?.rec_until ?? '')
  const [reminder, setReminder] = useState(event ? (event.reminder_minutes == null ? '' : String(event.reminder_minutes)) : '30')
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [yearKnown, setYearKnown] = useState(event ? event.birth_year != null : true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const birthday = kind === 'birthday'
  const reminders = birthday ? REMINDERS_BIRTHDAY : allDay ? REMINDERS_ALL_DAY : REMINDERS_TIMED

  // Autres rendez-vous de la même personne au même moment (simple avertissement, rien n'est bloqué)
  const clashes = useMemo(() => {
    if (birthday || allDay) return []
    const start = `${startDay}T${startTime}`
    const end = `${endDay}T${endTime}`
    if (end <= start) return []
    const concerns = (other: string) => owner === BOTH || other === BOTH || other === owner
    return events
      .filter((e) => e.id !== event?.id && e.kind === 'event' && !e.all_day && concerns(e.owner))
      .flatMap((e) => expand(e, startDay, endDay))
      .filter((o) => o.start < end && o.end > start)
      .slice(0, MAX_CLASHES)
  }, [events, event, birthday, allDay, startDay, startTime, endDay, endTime, owner])

  const changeScope = (s: 'one' | 'series') => {
    const d = datesFor(s)
    setScope(s)
    setStartDay(d.start.slice(0, 10))
    setEndDay(d.end.slice(0, 10))
    if (d.start.length > 10) {
      setStartTime(d.start.slice(11))
      setEndTime(d.end.slice(11))
    }
  }

  const changeKind = (k: 'event' | 'birthday') => {
    setKind(k)
    // Un anniversaire se prépare : par défaut on prévient quelques jours avant
    setReminder(k === 'birthday' ? '4320' : '30')
    setOwner(k === 'birthday' ? BOTH : me.id)
  }

  // Déplacer le début déplace la fin d'autant : la durée reste la même
  const moveStart = (newDay: string, newTime: string) => {
    if (!newDay || !newTime) return
    const delta = parseLocal(`${newDay}T${newTime}`).getTime() - parseLocal(`${startDay}T${startTime}`).getTime()
    const end = fmtLocal(new Date(parseLocal(`${endDay}T${endTime}`).getTime() + delta))
    setStartDay(newDay)
    setStartTime(newTime)
    setEndDay(end.slice(0, 10))
    setEndTime(end.slice(11))
  }

  const toggleAllDay = (on: boolean) => {
    setAllDay(on)
    const options = on ? REMINDERS_ALL_DAY : REMINDERS_TIMED
    if (!options.some((o) => o.value === reminder)) setReminder('0')
  }

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      onClose()
      done?.()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  const save = () => {
    if (!title.trim()) return setError(birthday ? 'Indiquez le prénom.' : 'Donnez un titre au rendez-vous.')
    const whole = birthday || allDay
    const start = whole ? startDay : `${startDay}T${startTime}`
    const end = birthday ? startDay : allDay ? endDay : `${endDay}T${endTime}`
    if (end < start) return setError('La fin est avant le début.')
    const rep = birthday ? REPEATS[5] : one ? REPEATS[0] : (REPEATS.find((r) => r.key === repeat) ?? REPEATS[0])
    const body = {
      title: title.trim(),
      all_day: whole,
      start_local: start,
      end_local: end,
      owner,
      rec_freq: rep.freq,
      rec_interval: rep.interval,
      rec_until: rep.freq !== 'none' && !birthday ? until || null : null,
      reminder_minutes: reminder === '' ? null : Number(reminder),
      location: birthday ? '' : location.trim(),
      notes: notes.trim(),
      category: birthday ? '' : category,
      kind,
      birth_year: birthday && yearKnown ? Number(startDay.slice(0, 4)) : null,
    }
    if (!event) return run(() => mutate({ method: 'POST', path: '/events', body: { ...body, id: uid() } }))
    if (one) return run(() => mutate({ method: 'POST', path: `/events/${event.id}/detach`, body: { day: occ!.day, event: { ...body, id: uid() } } }))
    run(() => mutate({ method: 'PUT', path: `/events/${event.id}`, body }))
  }

  const remove = () => {
    if (!event) return
    if (one) {
      const path = `/events/${event.id}/exdate`
      return run(
        () => mutate({ method: 'POST', path, body: { day: occ!.day } }),
        () => toast('Date supprimée', () => mutate({ method: 'DELETE', path: `${path}/${occ!.day}`, silent: true }).catch(() => {})),
      )
    }
    run(
      () => mutate({ method: 'DELETE', path: `/events/${event.id}` }),
      () => toast(birthday ? 'Anniversaire supprimé' : 'Rendez-vous supprimé', () => mutate({ method: 'POST', path: '/events', body: event, silent: true }).catch(() => {})),
    )
  }

  const heading = birthday ? 'Anniversaire' : event ? 'Rendez-vous' : 'Nouveau rendez-vous'

  return (
    <Sheet title={heading} busy={busy} onClose={onClose} onSubmit={save}>
      {!event && (
        <div className="segmented">
          <button type="button" className={!birthday ? 'on accent' : ''} onClick={() => changeKind('event')}>
            Rendez-vous
          </button>
          <button type="button" className={birthday ? 'on accent' : ''} onClick={() => changeKind('birthday')}>
            🎂 Anniversaire
          </button>
        </div>
      )}

      {inSeries && (
        <div className="field">
          <span className="label">Rendez-vous répété : modifier ou supprimer…</span>
          <div className="segmented">
            <button type="button" className={one ? 'on accent' : ''} onClick={() => changeScope('one')}>
              Cette date seulement
            </button>
            <button type="button" className={!one ? 'on accent' : ''} onClick={() => changeScope('series')}>
              Toute la série
            </button>
          </div>
        </div>
      )}

      <input className="title-input" placeholder={birthday ? 'Prénom' : 'Titre'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus={!event} />

      {birthday ? (
        <>
          <label className="row">
            <span>Date de naissance</span>
            <input type="date" value={startDay} onChange={(e) => e.target.value && setStartDay(e.target.value)} required />
          </label>
          <label className="row">
            <span>Je connais l'année (pour afficher l'âge)</span>
            <input type="checkbox" className="switch" checked={yearKnown} onChange={(e) => setYearKnown(e.target.checked)} />
          </label>
        </>
      ) : (
        <>
          <label className="row">
            <span>Toute la journée</span>
            <input type="checkbox" className="switch" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
          </label>
          <div className="row">
            <span>Début</span>
            <span className="inputs">
              <input type="date" value={startDay} onChange={(e) => moveStart(e.target.value, startTime)} required />
              {!allDay && <input type="time" value={startTime} onChange={(e) => moveStart(startDay, e.target.value)} required />}
            </span>
          </div>
          <div className="row">
            <span>Fin</span>
            <span className="inputs">
              <input type="date" value={endDay} min={startDay} onChange={(e) => e.target.value && setEndDay(e.target.value)} required />
              {!allDay && <input type="time" value={endTime} onChange={(e) => e.target.value && setEndTime(e.target.value)} required />}
            </span>
          </div>
        </>
      )}

      <div className="field">
        <span className="label">Pour qui</span>
        <OwnerPicker value={owner} members={members} onChange={setOwner} />
      </div>

      {clashes.length > 0 && (
        <p className="warn">
          ⚠ En même temps : {clashes.map((o) => `${displayTitle(o.event)} (${o.start.slice(11)} – ${o.end.slice(11)})`).join(', ')}
        </p>
      )}

      {!birthday && (
        <div className="cats">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={c.id === category ? 'chip on' : 'chip'} onClick={() => setCategory(c.id === category ? '' : c.id)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      {!birthday && !one && (
        <label className="row">
          <span>Répéter</span>
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEATS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {!birthday && !one && repeat !== 'none' && (
        <label className="row">
          <span>Jusqu'au (facultatif)</span>
          <input type="date" value={until} min={startDay} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}

      <label className="row">
        <span>Rappel</span>
        <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
          {reminders.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {!birthday && (
        <>
          <input placeholder="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          {location.trim() && (
            <a className="link map-link" href={mapsUrl(location.trim())} target="_blank" rel="noreferrer">
              📍 Voir sur la carte
            </a>
          )}
        </>
      )}
      <textarea placeholder={birthday ? "Notes (idées de cadeau…)" : 'Notes'} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />

      {error && <p className="error">{error}</p>}

      {event && (
        <button type="button" className="danger" disabled={busy} onClick={remove}>
          {!inSeries ? 'Supprimer' : one ? 'Supprimer cette date' : 'Supprimer toute la série'}
        </button>
      )}
    </Sheet>
  )
}
