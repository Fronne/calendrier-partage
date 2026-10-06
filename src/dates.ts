import { DAY, expand, fmtDay, parseLocal } from '../shared/recurrence'
import type { CalEvent, Occurrence } from '../shared/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Jour actuel du téléphone, 'YYYY-MM-DD'. */
export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Prochaine heure ronde, 'HH:00'. */
export const nextHour = () => `${pad(Math.min(23, new Date().getHours() + 1))}:00`

export const addDays = (day: string, n: number) => fmtDay(new Date(parseLocal(day).getTime() + n * DAY))

export const monthStart = (day: string) => day.slice(0, 8) + '01'

export function addMonths(monthDay: string, n: number): string {
  const d = parseLocal(monthDay)
  return fmtDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}

/** Jours affichés pour un mois : semaines complètes, du lundi au dimanche. */
export function monthGrid(monthDay: string): string[] {
  const first = parseLocal(monthDay)
  const offset = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) => fmtDay(new Date(first.getTime() + (i - offset) * DAY)))
}

/** Lundi de la semaine qui contient ce jour. */
export const mondayOf = (day: string) => addDays(day, -((parseLocal(day).getUTCDay() + 6) % 7))

/** Minutes écoulées depuis minuit pour 'YYYY-MM-DDTHH:mm'. */
export const minutesOf = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16))

const formatter = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' })
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const monthFmt = formatter({ month: 'long', year: 'numeric' })
const longDayFmt = formatter({ weekday: 'long', day: 'numeric', month: 'long' })
const shortDayFmt = formatter({ weekday: 'short', day: 'numeric', month: 'short' })

export const fmtMonth = (day: string) => capital(monthFmt.format(parseLocal(day)))
export const fmtShortDay = (day: string) => shortDayFmt.format(parseLocal(day))

const rangeFmt = formatter({ day: 'numeric', month: 'short' })
const rangeYearFmt = formatter({ day: 'numeric', month: 'short', year: 'numeric' })
/** « 5–11 oct. », avec l'année seulement si ce n'est pas l'année en cours */
export const fmtRange = (from: string, to: string) =>
  (to.slice(0, 4) === todayKey().slice(0, 4) ? rangeFmt : rangeYearFmt).formatRange(parseLocal(from), parseLocal(to))

const fullDayFmt = formatter({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const fmtFullDay = (day: string) => fullDayFmt.format(parseLocal(day))

/** « Mercredi 7 octobre », pour l'en-tête. */
export const fmtToday = () => capital(longDayFmt.format(parseLocal(todayKey())))

export function fmtLongDay(day: string): string {
  const today = todayKey()
  const label = capital(longDayFmt.format(parseLocal(day)))
  if (day === today) return `Aujourd'hui · ${label}`
  if (day === addDays(today, 1)) return `Demain · ${label}`
  return label
}

/** Occurrences rangées par jour affiché ; un événement sur plusieurs jours apparaît chaque jour concerné. */
export function occurrencesByDay(events: CalEvent[], from: string, to: string): Map<string, Occurrence[]> {
  const map = new Map<string, Occurrence[]>()
  for (const ev of events) {
    for (const occ of expand(ev, from, to)) {
      let last = occ.end.slice(0, 10)
      // Un événement qui finit à minuit pile ne déborde pas sur le jour suivant
      if (!ev.all_day && occ.end.slice(11) === '00:00' && last > occ.day) last = addDays(last, -1)
      for (let d = occ.day < from ? from : occ.day; d <= last && d <= to; d = addDays(d, 1)) {
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(occ)
      }
    }
  }
  for (const [day, list] of map) {
    const key = (o: Occurrence) => (o.event.all_day || o.day < day ? '' : o.start)
    list.sort((a, b) => key(a).localeCompare(key(b)) || a.event.title.localeCompare(b.event.title))
  }
  return map
}

/** Horaire d'une occurrence telle qu'elle se présente un jour donné. */
export function occTimeLabel(occ: Occurrence, day: string): string {
  if (occ.event.all_day) return 'Journée'
  const startDay = occ.start.slice(0, 10)
  const endDay = occ.end.slice(0, 10)
  const start = occ.start.slice(11)
  const end = occ.end.slice(11)
  if (startDay === endDay) return start === end ? start : `${start} – ${end}`
  if (day === startDay) return `${start} →`
  if (day === endDay) return `→ ${end}`
  return 'Journée'
}
