export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export const FREQS: Freq[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']

/** Valeur de `owner` pour ce qui concerne les deux personnes. */
export const BOTH = 'both'

export const CATEGORIES = [
  { id: 'work', icon: '💼', label: 'Travail' },
  { id: 'health', icon: '🩺', label: 'Santé' },
  { id: 'outing', icon: '🍽️', label: 'Sorties' },
  { id: 'family', icon: '👪', label: 'Famille' },
  { id: 'sport', icon: '🏃', label: 'Sport' },
  { id: 'travel', icon: '✈️', label: 'Voyage' },
  { id: 'home', icon: '🏠', label: 'Maison' },
  { id: 'admin', icon: '📄', label: 'Papiers' },
]

export interface Member {
  id: string
  name: string
  color: string
  /** Prévenu par notification quand l'autre ajoute, modifie ou supprime quelque chose */
  notify_changes: boolean
}

export interface CalEvent {
  id: string
  /** Pour un anniversaire : le prénom de la personne */
  title: string
  /** 'YYYY-MM-DDTHH:mm', ou 'YYYY-MM-DD' si all_day */
  start_local: string
  /** Même format que start_local ; pour all_day, dernier jour inclus */
  end_local: string
  all_day: boolean
  location: string
  notes: string
  owner: string
  rec_freq: Freq
  rec_interval: number
  /** Dernier jour possible d'une occurrence (inclus) */
  rec_until: string | null
  /** Jours ('YYYY-MM-DD') des occurrences supprimées individuellement */
  exdates: string[]
  /** null = pas de rappel */
  reminder_minutes: number | null
  /**
   * Heure choisie ('HH:mm') : le rappel part à cette heure, reminder_minutes / 1440 jours avant le jour du début.
   * null : le rappel part reminder_minutes avant le début (ou avant 9 h pour une journée entière).
   */
  reminder_time: string | null
  /** Identifiant dans CATEGORIES, ou '' */
  category: string
  kind: 'event' | 'birthday'
  /** Année de naissance d'un anniversaire, si connue */
  birth_year: number | null
  updated_at: string
}

export interface Task {
  id: string
  title: string
  due_date: string | null
  owner: string
  done: boolean
  done_at: string | null
  /** Une tâche répétée cochée repart à son échéance suivante au lieu de passer en "terminée" */
  rec_freq: Freq
  rec_interval: number
  /** Rappel : mêmes règles que pour un rendez-vous « journée entière » ; null = aucun */
  reminder_minutes: number | null
  reminder_time: string | null
  updated_at: string
}

export interface Occurrence {
  event: CalEvent
  start: string
  end: string
  /** Jour de début de l'occurrence, sert de clé pour exdates */
  day: string
}

export interface SyncData {
  me: string
  members: Member[]
  events: CalEvent[]
  tasks: Task[]
}

export interface HolidayPeriod {
  name: string
  /** Premier et dernier jour de vacances, inclus */
  start: string
  end: string
}

export function eventIcon(ev: CalEvent): string {
  if (ev.kind === 'birthday') return '🎂'
  return CATEGORIES.find((c) => c.id === ev.category)?.icon ?? ''
}

/** Titre affiché ; pour un anniversaire, `day` (jour de l'occurrence) permet d'ajouter l'âge. */
export function displayTitle(ev: CalEvent, day?: string): string {
  if (ev.kind !== 'birthday') return ev.title
  const de = /^[aeiouyhàâäéèêëîïôöùûü]/i.test(ev.title) ? "d'" : 'de '
  const age = ev.birth_year && day ? Number(day.slice(0, 4)) - ev.birth_year : 0
  return `Anniversaire ${de}${ev.title}` + (age > 0 ? ` (${age} ans)` : '')
}
