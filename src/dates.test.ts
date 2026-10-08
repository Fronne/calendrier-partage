import { describe, expect, it } from 'vitest'
import { isoWeek, packSpans } from './dates'

describe('isoWeek', () => {
  it('numérote les semaines du lundi au dimanche', () => {
    expect(isoWeek('2026-11-01')).toBe(44)
    expect(isoWeek('2026-11-02')).toBe(45)
    expect(isoWeek('2026-11-08')).toBe(45)
  })

  it("rattache les jours de début et de fin d'année à la bonne semaine", () => {
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53)
    expect(isoWeek('2024-12-30')).toBe(1)
  })
})

describe('packSpans', () => {
  it('met sur des lignes différentes les bandes qui se chevauchent', () => {
    const slots = packSpans([{ id: 'a', from: 0, to: 3 }, { id: 'b', from: 2, to: 4 }, { id: 'c', from: 4, to: 6 }])
    expect(slots.map((s) => [s.id, s.slot])).toEqual([['a', 0], ['b', 1], ['c', 0]])
  })

  it('place la bande la plus longue en premier quand deux commencent le même jour', () => {
    const slots = packSpans([{ id: 'court', from: 1, to: 1 }, { id: 'long', from: 1, to: 5 }])
    expect(slots.map((s) => [s.id, s.slot])).toEqual([['long', 0], ['court', 1]])
  })
})
