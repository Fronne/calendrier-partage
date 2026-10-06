import { describe, expect, it } from 'vitest'
import { dueReminders, expand, nextDue, parseLocal } from './recurrence'
import { displayTitle, type CalEvent } from './types'

function ev(p: Partial<CalEvent>): CalEvent {
  return {
    id: 'e1',
    title: 'Test',
    start_local: '2026-10-06T14:00',
    end_local: '2026-10-06T15:00',
    all_day: false,
    location: '',
    notes: '',
    owner: 'both',
    rec_freq: 'none',
    rec_interval: 1,
    rec_until: null,
    exdates: [],
    reminder_minutes: null,
    category: '',
    kind: 'event',
    birth_year: null,
    updated_at: '',
    ...p,
  }
}

describe('nextDue', () => {
  it('avance d’un cran quand la tâche est faite à temps ou en avance', () => {
    expect(nextDue('2026-10-06', 'weekly', 1, '2026-10-06')).toBe('2026-10-13')
    expect(nextDue('2026-10-06', 'weekly', 1, '2026-10-03')).toBe('2026-10-13')
    expect(nextDue('2026-10-06', 'monthly', 1, '2026-10-06')).toBe('2026-11-06')
  })

  it('saute les échéances déjà passées quand la tâche était en retard', () => {
    expect(nextDue('2026-10-06', 'weekly', 1, '2026-10-21')).toBe('2026-10-27')
    expect(nextDue('2026-10-06', 'daily', 1, '2026-10-21')).toBe('2026-10-22')
  })
})

describe('displayTitle', () => {
  it('anniversaire avec âge et élision', () => {
    const b = ev({ kind: 'birthday', title: 'Alice', birth_year: 1994, all_day: true, start_local: '1994-03-12', end_local: '1994-03-12', rec_freq: 'yearly' })
    expect(displayTitle(b, '2027-03-12')).toBe("Anniversaire d'Alice (33 ans)")
    expect(displayTitle({ ...b, title: 'Paul', birth_year: null }, '2027-03-12')).toBe('Anniversaire de Paul')
    expect(expand(b, '2027-03-01', '2027-03-31').map((o) => o.start)).toEqual(['2027-03-12'])
  })
})

const starts = (e: CalEvent, from: string, to: string) => expand(e, from, to).map((o) => o.start)

describe('expand', () => {
  it('événement unique dans / hors période', () => {
    expect(starts(ev({}), '2026-10-01', '2026-10-31')).toEqual(['2026-10-06T14:00'])
    expect(starts(ev({}), '2026-10-07', '2026-10-31')).toEqual([])
    expect(starts(ev({}), '2026-10-06', '2026-10-06')).toEqual(['2026-10-06T14:00'])
  })

  it('hebdomadaire, toutes les 2 semaines', () => {
    const e = ev({ rec_freq: 'weekly', rec_interval: 2 })
    expect(starts(e, '2026-10-01', '2026-11-10')).toEqual(['2026-10-06T14:00', '2026-10-20T14:00', '2026-11-03T14:00'])
  })

  it("garde la même heure après le changement d'heure (25 octobre 2026)", () => {
    const e = ev({ rec_freq: 'weekly', start_local: '2026-10-20T08:30', end_local: '2026-10-20T09:00' })
    expect(starts(e, '2026-10-26', '2026-11-01')).toEqual(['2026-10-27T08:30'])
  })

  it('quotidien loin dans le futur', () => {
    const e = ev({ rec_freq: 'daily' })
    expect(starts(e, '2030-01-01', '2030-01-02')).toEqual(['2030-01-01T14:00', '2030-01-02T14:00'])
  })

  it('mensuel le 31 : ramené en fin de mois sans dériver', () => {
    const e = ev({ rec_freq: 'monthly', start_local: '2026-01-31T10:00', end_local: '2026-01-31T11:00' })
    expect(starts(e, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31T10:00',
      '2026-02-28T10:00',
      '2026-03-31T10:00',
      '2026-04-30T10:00',
    ])
  })

  it('annuel un 29 février', () => {
    const e = ev({ rec_freq: 'yearly', all_day: true, start_local: '2024-02-29', end_local: '2024-02-29' })
    expect(starts(e, '2027-01-01', '2028-12-31')).toEqual(['2027-02-28', '2028-02-29'])
  })

  it('date de fin incluse et occurrences supprimées', () => {
    const e = ev({ rec_freq: 'daily', rec_until: '2026-10-09', exdates: ['2026-10-07'] })
    expect(starts(e, '2026-10-01', '2026-10-31')).toEqual(['2026-10-06T14:00', '2026-10-08T14:00', '2026-10-09T14:00'])
  })

  it('journée entière sur plusieurs jours', () => {
    const e = ev({ all_day: true, start_local: '2026-10-06', end_local: '2026-10-08' })
    expect(expand(e, '2026-10-08', '2026-10-08')).toMatchObject([{ start: '2026-10-06', end: '2026-10-08' }])
    expect(expand(e, '2026-10-09', '2026-10-09')).toEqual([])
  })

  it('événement qui passe minuit visible le lendemain', () => {
    const e = ev({ start_local: '2026-10-06T22:00', end_local: '2026-10-07T02:00' })
    expect(starts(e, '2026-10-07', '2026-10-07')).toEqual(['2026-10-06T22:00'])
  })
})

describe('dueReminders', () => {
  const due = (e: CalEvent, after: string, upTo: string) =>
    dueReminders([e], parseLocal(after), parseLocal(upTo)).map((o) => o.start)

  it('envoie une seule fois, dans la bonne minute', () => {
    const e = ev({ reminder_minutes: 30 })
    expect(due(e, '2026-10-06T13:28', '2026-10-06T13:29')).toEqual([])
    expect(due(e, '2026-10-06T13:29', '2026-10-06T13:30')).toEqual(['2026-10-06T14:00'])
    expect(due(e, '2026-10-06T13:30', '2026-10-06T13:31')).toEqual([])
  })

  it('ignore les événements sans rappel', () => {
    expect(due(ev({}), '2026-10-06T13:00', '2026-10-06T15:00')).toEqual([])
  })

  it('la veille pour un événement récurrent', () => {
    const e = ev({ rec_freq: 'weekly', reminder_minutes: 1440 })
    expect(due(e, '2026-10-12T13:59', '2026-10-12T14:00')).toEqual(['2026-10-13T14:00'])
  })

  it('journée entière : rappel à 9 h', () => {
    const e = ev({ all_day: true, start_local: '2026-10-06', end_local: '2026-10-06', reminder_minutes: 0 })
    expect(due(e, '2026-10-06T08:59', '2026-10-06T09:00')).toEqual(['2026-10-06'])
    expect(due(e, '2026-10-05T23:59', '2026-10-06T00:00')).toEqual([])
  })
})
