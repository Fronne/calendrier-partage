import { addDays, fmtDay, occTimeLabel, occurrencesByDay } from '../shared/recurrence'
import { BOTH, BOTH_COLOR, displayTitle, eventIcon, type CalEvent, type Member, type Task } from '../shared/types'
import { localNow } from './reminders'

/** Période couverte par le widget Android, et nombre de lignes qu'il reçoit au plus. */
const WIDGET_DAYS = 30
const WIDGET_MAX = 40

export interface WidgetItem {
  /** Jour sous lequel la ligne se range ; pour une tâche en retard, son échéance passée */
  day: string
  /** Horaire prêt à afficher, vide pour une tâche */
  time: string
  title: string
  color: string
  task: boolean
}

// Tout est calculé ici pour que le widget n'ait qu'à afficher : pas de règles de répétition à refaire sur le téléphone
export function widgetData(tz: string, members: Member[], events: CalEvent[], tasks: Task[]) {
  const today = fmtDay(localNow(tz))
  const to = addDays(today, WIDGET_DAYS)
  const color = (owner: string) => (owner === BOTH ? BOTH_COLOR : (members.find((m) => m.id === owner)?.color ?? '#6b7280'))
  const taskItem = (t: Task): WidgetItem => ({ day: t.due_date!, time: '', title: t.title, color: color(t.owner), task: true })
  const open = tasks.filter((t) => !t.done && t.due_date)

  const items = open
    .filter((t) => t.due_date! < today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .map(taskItem)
  const byDay = occurrencesByDay(events, today, to)
  for (let d = today; d <= to && items.length < WIDGET_MAX; d = addDays(d, 1)) {
    for (const occ of byDay.get(d) ?? []) {
      const ev = occ.event
      items.push({ day: d, time: occTimeLabel(occ, d), title: `${eventIcon(ev)} ${displayTitle(ev, occ.day)}`.trim(), color: color(ev.owner), task: false })
    }
    items.push(...open.filter((t) => t.due_date === d).map(taskItem))
  }
  return { today, items: items.slice(0, WIDGET_MAX) }
}
