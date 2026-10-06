import { DAY, fmtDay } from '../shared/recurrence'
import type { HolidayPeriod } from '../shared/types'
import { getMeta, setMeta } from './db'
import type { Env } from './env'
import { localNow } from './reminders'

// Calendrier scolaire officiel (données ouvertes de l'Éducation nationale)
const API = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records'

/** Une académie suffit : toutes celles d'une même zone ont les mêmes dates. */
export const ZONE_ACADEMY: Record<string, string> = { A: 'Lyon', B: 'Lille', C: 'Paris' }

const REFRESH_MS = 7 * DAY

async function download(env: Env, zone: string): Promise<HolidayPeriod[]> {
  const since = new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10)
  const params = new URLSearchParams({
    select: 'description,population,start_date,end_date',
    where: `zones="Zone ${zone}" and location="${ZONE_ACADEMY[zone]}" and end_date >= "${since}"`,
    order_by: 'start_date',
    limit: '60',
  })
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error(`calendrier scolaire : ${res.status}`)
  const { results } = (await res.json()) as { results: any[] }

  const periods: HolidayPeriod[] = []
  for (const r of results) {
    if (r.population === 'Enseignants') continue
    // start_date = premier jour de vacances à 0 h (heure de Paris) ; end_date = jour de la reprise
    const start = localNow(env.TZ_NAME, new Date(r.start_date))
    const end = new Date(localNow(env.TZ_NAME, new Date(r.end_date)).getTime() - DAY)
    if (end < start) continue // simples repères d'un jour ("Début des vacances d'été")
    periods.push({ name: r.description, start: fmtDay(start), end: fmtDay(end) })
  }
  return periods
}

/** Vacances scolaires de la zone, gardées en base et rafraîchies chaque semaine. */
export async function schoolHolidays(env: Env, zone: string): Promise<HolidayPeriod[]> {
  const key = 'holidays:' + zone
  const cached = JSON.parse((await getMeta(env, key)) ?? 'null') as { at: number; periods: HolidayPeriod[] } | null
  if (cached && Date.now() - cached.at < REFRESH_MS) return cached.periods
  try {
    const periods = await download(env, zone)
    await setMeta(env, key, JSON.stringify({ at: Date.now(), periods }))
    return periods
  } catch (e) {
    console.error(e)
    return cached?.periods ?? []
  }
}
