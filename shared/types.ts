export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export const FREQS: Freq[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']

/** Valeur de `owner` pour ce qui concerne les deux personnes. */
export const BOTH = 'both'

/** Couleur de ce qui concerne les deux. */
export const BOTH_COLOR = '#7c3aed'

export interface Category {
  id: string
  icon: string
  label: string
  /** Précisions possibles (activités d'un sport…) : la première reprend l'identifiant de la catégorie */
  variants?: { id: string; icon: string; label: string }[]
}

export const CATEGORIES: Category[] = [
  { id: 'work', icon: '💼', label: 'Travail' },
  { id: 'health', icon: '🩺', label: 'Santé' },
  { id: 'outing', icon: '🎉', label: 'Sorties' },
  { id: 'family', icon: '❤️', label: 'Famille' },
  {
    id: 'sport',
    icon: '🏃',
    label: 'Sport',
    variants: [
      { id: 'sport', icon: '🏃', label: 'Course à pied' },
      { id: 'sport-volley', icon: '🏐', label: 'Volley' },
      { id: 'sport-badminton', icon: '🏸', label: 'Badminton' },
      { id: 'sport-tennis', icon: '🎾', label: 'Tennis' },
      { id: 'sport-padel', icon: '🏓', label: 'Padel' },
      { id: 'sport-bike', icon: '🚴', label: 'Vélo' },
      { id: 'sport-swim', icon: '🏊', label: 'Natation' },
      { id: 'sport-gym', icon: '🏋️', label: 'Muscu' },
      { id: 'sport-hike', icon: '🥾', label: 'Rando' },
    ],
  },
  { id: 'travel', icon: '✈️', label: 'Voyage' },
  { id: 'home', icon: '🏠', label: 'Maison' },
  { id: 'admin', icon: '📄', label: 'Papiers' },
  { id: 'school', icon: '🎓', label: 'École' },
  { id: 'kids', icon: '👶', label: 'Enfants' },
  { id: 'friends', icon: '👥', label: 'Amis' },
  { id: 'pets', icon: '🐾', label: 'Animaux' },
  { id: 'shopping', icon: '🛒', label: 'Courses' },
  { id: 'restaurant', icon: '🍽️', label: 'Restaurant' },
  { id: 'cinema', icon: '🎬', label: 'Cinéma' },
  { id: 'music', icon: '🎵', label: 'Musique' },
  { id: 'hair', icon: '💇', label: 'Coiffeur' },
  { id: 'car', icon: '🚗', label: 'Voiture' },
  { id: 'works', icon: '🔧', label: 'Travaux' },
  { id: 'garden', icon: '🌱', label: 'Jardin' },
  { id: 'money', icon: '💰', label: 'Argent' },
  { id: 'gift', icon: '🎁', label: 'Cadeau' },
  { id: 'holiday', icon: '🏖️', label: 'Vacances' },
  { id: 'call', icon: '📞', label: 'Appel' },
]

/** Catégories toujours proposées dans le formulaire ; les suivantes se déplient avec « Plus de catégories ». */
export const MAIN_CATEGORIES = 8

/** Catégorie à laquelle appartient cet identifiant (le sien ou celui d'une de ses variantes). */
export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id || c.variants?.some((v) => v.id === id))

export function categoryIcon(id: string): string {
  const cat = categoryOf(id)
  return cat?.variants?.find((v) => v.id === id)?.icon ?? cat?.icon ?? ''
}

export const isCategory = (id: unknown) => typeof id === 'string' && !!id && !!categoryOf(id)

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
  /** Identifiant d'une catégorie de CATEGORIES ou d'une de ses variantes, ou '' */
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
  return categoryIcon(ev.category)
}

/** Titre affiché ; pour un anniversaire, `day` (jour de l'occurrence) permet d'ajouter l'âge. */
export function displayTitle(ev: CalEvent, day?: string): string {
  if (ev.kind !== 'birthday') return ev.title
  const de = /^[aeiouyhàâäéèêëîïôöùûü]/i.test(ev.title) ? "d'" : 'de '
  const age = ev.birth_year && day ? Number(day.slice(0, 4)) - ev.birth_year : 0
  return `Anniversaire ${de}${ev.title}` + (age > 0 ? ` (${age} ans)` : '')
}
