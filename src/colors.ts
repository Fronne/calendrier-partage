import type { CSSProperties } from 'react'
import { BOTH, BOTH_COLOR, type Member } from '../shared/types'

export { BOTH_COLOR }

/** Couleurs proposées à chaque personne, avec le nom lu par les lecteurs d'écran. */
export const COLORS = [
  { hex: '#2563eb', name: 'Bleu' },
  { hex: '#e11d48', name: 'Rouge' },
  { hex: '#059669', name: 'Vert' },
  { hex: '#d97706', name: 'Orange' },
  { hex: '#0891b2', name: 'Turquoise' },
  { hex: '#db2777', name: 'Rose' },
]

export const PALETTE = COLORS.map((c) => c.hex)

const DARK_TEXT = '#191a24'

/** Luminance relative d'une couleur « #rrggbb » (WCAG). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Texte lisible sur un aplat de cette couleur : blanc, ou foncé quand le blanc manque de contraste (orange, vert, turquoise). */
export const onColor = (hex: string) => (1.05 / (luminance(hex) + 0.05) >= 4.5 ? '#fff' : DARK_TEXT)

/** Donne aux styles la couleur d'une personne (--c) et celle du texte posé dessus (--on-c) : fond teinté, texte, bordure s'en déduisent. */
export const tint = (color: string) => ({ '--c': color, '--on-c': onColor(color) }) as CSSProperties

export function colorOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return BOTH_COLOR
  return members.find((m) => m.id === owner)?.color ?? '#6b7280'
}

export function nameOf(owner: string, members: Member[]): string {
  if (owner === BOTH) return 'Nous deux'
  return members.find((m) => m.id === owner)?.name ?? '?'
}
