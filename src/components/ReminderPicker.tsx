import Choice, { type Option } from './Choice'
import TimeInput from './TimeInput'

export interface Reminder {
  /** null = pas de rappel */
  minutes: number | null
  /** Heure choisie pour un rappel compté en jours ; null = rappel relatif à l'heure du rendez-vous */
  time: string | null
}

export const NO_REMINDER: Reminder = { minutes: null, time: null }

/** Heure à laquelle partait un rappel « journée » avant qu'on puisse la choisir. */
const LEGACY_DAY_TIME = '09:00'
const DEFAULT_SAME_DAY = '09:00'
const DEFAULT_DAYS_BEFORE = '18:00'

const RELATIVE = [
  { minutes: 0, label: "À l'heure du rendez-vous" },
  { minutes: 10, label: '10 minutes avant' },
  { minutes: 30, label: '30 minutes avant' },
  { minutes: 60, label: '1 heure avant' },
  { minutes: 120, label: '2 heures avant' },
]

const DAYS = [
  { days: 0, label: 'Le jour même, à…' },
  { days: 1, label: 'La veille, à…' },
  { days: 2, label: '2 jours avant, à…' },
  { days: 3, label: '3 jours avant, à…' },
  { days: 7, label: '1 semaine avant, à…' },
]

/**
 * Rappel tel qu'il est enregistré → rappel tel que le formulaire le montre.
 * Les anciens rappels en jours n'avaient pas d'heure : on affiche celle à laquelle ils partaient réellement.
 */
export function reminderFrom(item: { reminder_minutes: number | null; reminder_time: string | null }, startTime: string | null): Reminder {
  const { reminder_minutes: minutes, reminder_time: time } = item
  if (minutes == null) return NO_REMINDER
  if (time) return { minutes, time }
  if (!startTime) return { minutes, time: LEGACY_DAY_TIME }
  return minutes >= 1440 ? { minutes, time: startTime } : { minutes, time: null }
}

interface Props {
  value: Reminder
  /** Les rappels « 10 minutes avant » n'existent que pour un rendez-vous qui a une heure */
  timed: boolean
  onChange: (r: Reminder) => void
}

export default function ReminderPicker({ value, timed, onChange }: Props) {
  const byDay = value.minutes != null && value.time != null
  const key = value.minutes == null ? '' : byDay ? `d${Math.round(value.minutes / 1440)}` : `m${value.minutes}`

  const choose = (k: string) => {
    if (!k) return onChange(NO_REMINDER)
    const n = Number(k.slice(1))
    if (k[0] === 'm') return onChange({ minutes: n, time: null })
    // On garde l'heure déjà choisie en changeant seulement le nombre de jours
    onChange({ minutes: n * 1440, time: value.time ?? (n === 0 ? DEFAULT_SAME_DAY : DEFAULT_DAYS_BEFORE) })
  }

  const options: Option[] = [
    { value: '', label: 'Aucun' },
    ...(timed ? RELATIVE.map((r) => ({ value: `m${r.minutes}`, label: r.label })) : []),
    ...DAYS.map((d, i) => ({ value: `d${d.days}`, label: d.label, divider: i === 0 })),
  ]

  return (
    <>
      <div className="row">
        <span>Rappel</span>
        <Choice label="Rappel" value={key} options={options} onChange={choose} />
      </div>
      {byDay && (
        <div className="row">
          <span>Heure du rappel</span>
          <TimeInput label="Heure du rappel" value={value.time!} onChange={(time) => onChange({ minutes: value.minutes, time })} />
        </div>
      )}
    </>
  )
}

/** Passe un rappel relatif (« 30 minutes avant ») en rappel du jour même quand le rendez-vous n'a plus d'heure. */
export const forAllDay = (r: Reminder): Reminder => (r.minutes != null && r.time == null ? { minutes: 0, time: DEFAULT_SAME_DAY } : r)
