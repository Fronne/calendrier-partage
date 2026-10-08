import { addDays, DAY, fmtDay, parseLocal } from '../shared/recurrence'

export { addDays, lastDayOf, occurrencesByDay, occTimeLabel } from '../shared/recurrence'

const pad = (n: number) => String(n).padStart(2, '0')

/** Jour actuel du téléphone, 'YYYY-MM-DD'. */
export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Prochaine heure ronde, 'HH:00'. */
export const nextHour = () => `${pad(Math.min(23, new Date().getHours() + 1))}:00`

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

/**
 * Range sur des lignes des bandes qui couvrent chacune les colonnes `from` à `to` (incluses) :
 * chaque bande prend la première ligne (`slot`) libre sur toute sa longueur.
 */
export function packSpans<T extends { from: number; to: number }>(spans: T[]): (T & { slot: number })[] {
  /** Dernière colonne occupée de chaque ligne. */
  const ends: number[] = []
  return [...spans]
    .sort((a, b) => a.from - b.from || b.to - a.to)
    .map((s) => {
      let slot = ends.findIndex((end) => end < s.from)
      if (slot < 0) slot = ends.length
      ends[slot] = s.to
      return { ...s, slot }
    })
}

/** Lundi de la semaine qui contient ce jour. */
export const mondayOf = (day: string) => addDays(day, -((parseLocal(day).getUTCDay() + 6) % 7))

/** Numéro de semaine ISO : semaines du lundi au dimanche, la première est celle du premier jeudi de l'année. */
export function isoWeek(day: string): number {
  const thursday = parseLocal(addDays(mondayOf(day), 3))
  return Math.floor((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / (7 * DAY)) + 1
}

const WEEKNUMS_KEY = 'cal.weeknums'
/** Numéros de semaine affichés dans le calendrier : réglage de ce téléphone. */
export const getWeekNums = () => localStorage.getItem(WEEKNUMS_KEY) === '1'
export const saveWeekNums = (on: boolean) => (on ? localStorage.setItem(WEEKNUMS_KEY, '1') : localStorage.removeItem(WEEKNUMS_KEY))

/** Minutes écoulées depuis minuit pour 'YYYY-MM-DDTHH:mm'. */
export const minutesOf = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16))

const formatter = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' })
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Mois abrégé quand l'année est affichée, pour que le titre tienne à côté du bouton « Aujourd'hui »
const monthFmt = formatter({ month: 'short', year: 'numeric' })
const longDayFmt = formatter({ weekday: 'long', day: 'numeric', month: 'long' })
const shortDayFmt = formatter({ weekday: 'short', day: 'numeric', month: 'short' })

const monthOnlyFmt = formatter({ month: 'long' })
/** « Octobre », ou « Janv. 2027 » si ce n'est pas l'année en cours */
export const fmtMonth = (day: string) =>
  capital((day.slice(0, 4) === todayKey().slice(0, 4) ? monthOnlyFmt : monthFmt).format(parseLocal(day)))
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

/** « à l'instant », « il y a 2 h », « hier à 18:30 », puis la date : pour un instant passé (ISO). */
export function fmtAgo(iso: string): string {
  const then = new Date(iso)
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`
  const day = `${then.getFullYear()}-${pad(then.getMonth() + 1)}-${pad(then.getDate())}`
  const time = `${pad(then.getHours())}:${pad(then.getMinutes())}`
  return `${day === addDays(todayKey(), -1) ? 'hier' : fmtShortDay(day)} à ${time}`
}

export function fmtLongDay(day: string): string {
  const today = todayKey()
  const label = capital(longDayFmt.format(parseLocal(day)))
  if (day === today) return `Aujourd'hui · ${label}`
  if (day === addDays(today, 1)) return `Demain · ${label}`
  return label
}
