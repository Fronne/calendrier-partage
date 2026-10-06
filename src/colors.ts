import { BOTH, type Member } from '../shared/types'

/** Couleurs proposées à chaque personne. */
export const PALETTE = ['#2563eb', '#e11d48', '#059669', '#d97706', '#0891b2', '#db2777']

/** Couleur de ce qui concerne les deux. */
export const BOTH_COLOR = '#7c3aed'

export function colorOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return BOTH_COLOR
  return members.find((m) => m.id === owner)?.color ?? '#6b7280'
}

export function nameOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return 'Nous deux'
  return members.find((m) => m.id === owner)?.name ?? '?'
}
