import type { CalEvent, Freq, Occurrence } from './types'

// Toutes les dates sont des heures locales "murales" : on les range dans des Date UTC
// uniquement pour faire de l'arithmétique, sans jamais dépendre du fuseau de la machine.

export const DAY = 86_400_000
/** Heure à laquelle un événement "toute la journée" est censé commencer pour les rappels. */
const ALL_DAY_REMINDER_HOUR = 9

export function parseLocal(s: string): Date {
  const [d, t] = s.split('T')
  const [y, m, dd] = d.split('-').map(Number)
  const [h, mi] = t ? t.split(':').map(Number) : [0, 0]
  return new Date(Date.UTC(y, m - 1, dd, h, mi))
}

export const fmtDay = (d: Date) => d.toISOString().slice(0, 10)
export const fmtLocal = (d: Date) => d.toISOString().slice(0, 16)

/** Ajoute n mois en gardant le jour du mois, ramené au dernier jour si le mois est trop court. */
export function addMonthsClamped(d: Date, n: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + n
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes()))
}

// La k-ième occurrence est toujours calculée depuis le début d'origine, pour qu'un
// "31 du mois" ne dérive pas vers le 28 après un passage par février.
function nth(start: Date, freq: Freq, interval: number, k: number): Date {
  switch (freq) {
    case 'daily':
      return new Date(start.getTime() + k * interval * DAY)
    case 'weekly':
      return new Date(start.getTime() + k * interval * 7 * DAY)
    case 'monthly':
      return addMonthsClamped(start, k * interval)
    case 'yearly':
      return addMonthsClamped(start, k * interval * 12)
    default:
      return start
  }
}

/** Occurrences de l'événement qui touchent la période [fromDay, toDay] (jours inclus). */
export function expand(ev: CalEvent, fromDay: string, toDay: string): Occurrence[] {
  const start = parseLocal(ev.start_local)
  const dur = Math.max(0, parseLocal(ev.end_local).getTime() - start.getTime()) + (ev.all_day ? DAY : 0)
  const from = parseLocal(fromDay).getTime()
  const to = parseLocal(toDay).getTime() + DAY
  const interval = Math.max(1, ev.rec_interval || 1)
  const until = ev.rec_freq !== 'none' && ev.rec_until ? parseLocal(ev.rec_until).getTime() + DAY : Infinity
  const out: Occurrence[] = []

  // Saute directement près du début de la période au lieu de parcourir toute la série
  let k = 0
  if (ev.rec_freq === 'daily' || ev.rec_freq === 'weekly') {
    const step = interval * (ev.rec_freq === 'weekly' ? 7 : 1) * DAY
    k = Math.max(0, Math.floor((from - dur - start.getTime()) / step))
  } else if (ev.rec_freq === 'monthly' || ev.rec_freq === 'yearly') {
    const f = new Date(from - dur)
    const months = (f.getUTCFullYear() - start.getUTCFullYear()) * 12 + f.getUTCMonth() - start.getUTCMonth() - 1
    k = Math.max(0, Math.floor(months / (interval * (ev.rec_freq === 'yearly' ? 12 : 1))))
  }

  for (let i = 0; i < 2000; i++, k++) {
    const s = nth(start, ev.rec_freq, interval, k)
    const t = s.getTime()
    if (t >= to || t >= until) break
    if (t + Math.max(dur, 1) > from && !ev.exdates.includes(fmtDay(s))) {
      const e = new Date(t + dur)
      out.push({
        event: ev,
        start: ev.all_day ? fmtDay(s) : fmtLocal(s),
        end: ev.all_day ? fmtDay(new Date(e.getTime() - DAY)) : fmtLocal(e),
        day: fmtDay(s),
      })
    }
    if (ev.rec_freq === 'none') break
  }
  return out
}

/** Prochaine échéance d'une tâche répétée que l'on vient de cocher : toujours après `today`. */
export function nextDue(due: string, freq: Freq, interval: number, today: string): string {
  const start = parseLocal(due)
  const step = Math.max(1, interval || 1)
  for (let k = 1; k < 5000; k++) {
    const day = fmtDay(nth(start, freq, step, k))
    if (day > today || freq === 'none') return day
  }
  return due
}

/** Moment (heure locale) à partir duquel se compte le délai de rappel. */
export function reminderBase(occ: Occurrence): Date {
  const s = parseLocal(occ.start)
  return occ.event.all_day ? new Date(s.getTime() + ALL_DAY_REMINDER_HOUR * 3_600_000) : s
}

/** Occurrences dont le rappel tombe dans l'intervalle ]after, upTo] (heures locales). */
export function dueReminders(events: CalEvent[], after: Date, upTo: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) {
    if (ev.reminder_minutes == null) continue
    const rem = ev.reminder_minutes * 60_000
    const fromDay = fmtDay(new Date(after.getTime() + rem))
    const toDay = fmtDay(new Date(upTo.getTime() + rem))
    for (const occ of expand(ev, fromDay, toDay)) {
      const t = reminderBase(occ).getTime() - rem
      if (t > after.getTime() && t <= upTo.getTime()) out.push(occ)
    }
  }
  return out
}
