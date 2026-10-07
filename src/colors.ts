import type { CSSProperties } from 'react'
import { BOTH, BOTH_COLOR, type Member } from '../shared/types'

export { BOTH_COLOR }

/** Couleurs proposées à chaque personne. */
export const PALETTE = ['#2563eb', '#e11d48', '#059669', '#d97706', '#0891b2', '#db2777']

/** Donne aux styles la couleur d'une personne (variable --c) : fond teinté, texte, bordure s'en déduisent. */
export const tint = (color: string) => ({ '--c': color }) as CSSProperties

export function colorOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return BOTH_COLOR
  return members.find((m) => m.id === owner)?.color ?? '#6b7280'
}

export function nameOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return 'Nous deux'
  return members.find((m) => m.id === owner)?.name ?? '?'
}
