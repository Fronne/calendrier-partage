import { describe, expect, it } from 'vitest'
import { isoWeek } from './dates'

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
