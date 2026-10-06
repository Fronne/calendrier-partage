import { useEffect, useState } from 'react'
import { DAY, fmtDay } from '../shared/recurrence'
import type { HolidayPeriod } from '../shared/types'
import { api } from './api'

export interface DayInfo {
  /** Nom du jour férié, s'il y en a un */
  holiday?: string
  /** Nom des vacances scolaires en cours */
  vacation?: string
}

export const ZONES = ['A', 'B', 'C']
const ZONE_KEY = 'cal.zone'

/** Zone scolaire choisie sur ce téléphone ; '' = ne pas afficher les vacances. */
export const getZone = () => localStorage.getItem(ZONE_KEY) ?? 'A'
export const saveZone = (zone: string) => localStorage.setItem(ZONE_KEY, zone)

// Dimanche de Pâques (algorithme de Meeus/Butcher)
function easter(year: number): number {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(year, month - 1, day)
}

const byYear = new Map<number, Record<string, string>>()

function publicHolidays(year: number): Record<string, string> {
  let list = byYear.get(year)
  if (!list) {
    const e = easter(year)
    const after = (days: number) => fmtDay(new Date(e + days * DAY))
    list = {
      [`${year}-01-01`]: "Jour de l'An",
      [after(1)]: 'Lundi de Pâques',
      [`${year}-05-01`]: 'Fête du Travail',
      [`${year}-05-08`]: 'Victoire de 1945',
      [after(39)]: 'Ascension',
      [after(50)]: 'Lundi de Pentecôte',
      [`${year}-07-14`]: 'Fête nationale',
      [`${year}-08-15`]: 'Assomption',
      [`${year}-11-01`]: 'Toussaint',
      [`${year}-11-11`]: 'Armistice de 1918',
      [`${year}-12-25`]: 'Noël',
    }
    byYear.set(year, list)
  }
  return list
}

export const holidayName = (day: string): string | undefined => publicHolidays(Number(day.slice(0, 4)))[day]

/** Vacances scolaires de la zone : copie du téléphone d'abord, puis mise à jour depuis le serveur. */
export function useSchoolHolidays(zone: string): HolidayPeriod[] {
  const [periods, setPeriods] = useState<HolidayPeriod[]>([])

  useEffect(() => {
    if (!zone) return setPeriods([])
    const key = 'cal.holidays.' + zone
    try {
      setPeriods(JSON.parse(localStorage.getItem(key) ?? '[]'))
    } catch {
      setPeriods([])
    }
    let cancelled = false
    api<{ periods: HolidayPeriod[] }>('/holidays?zone=' + zone)
      .then(({ periods }) => {
        if (cancelled || !periods.length) return
        localStorage.setItem(key, JSON.stringify(periods))
        setPeriods(periods)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [zone])

  return periods
}

export function dayInfoFor(periods: HolidayPeriod[]) {
  return (day: string): DayInfo => ({
    holiday: holidayName(day),
    vacation: periods.find((p) => p.start <= day && day <= p.end)?.name,
  })
}
