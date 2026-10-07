import type { ReactNode } from 'react'
import { displayTitle, eventIcon, type Occurrence, type Task } from '../../shared/types'
import { colorOf, nameOf, tint } from '../colors'
import { fmtShortDay, occTimeLabel, todayKey } from '../dates'
import { useStore } from '../store'
import Icon from './Icon'

export function EventRow({ occ, day }: { occ: Occurrence; day: string }) {
  const { members, openEvent } = useStore()
  const ev = occ.event
  const icon = eventIcon(ev)
  // « 14:00 – 15:00 » s'affiche sur deux lignes : début, puis fin
  const [from, to] = occTimeLabel(occ, day).split(' – ')
  return (
    <button className="item" style={tint(colorOf(ev.owner, members))} onClick={() => openEvent(occ)}>
      {/* Pastille à la couleur de la personne : l'icône de catégorie, ou un simple point */}
      <span className="badge">{icon || <i />}</span>
      <span className="time">
        <b>{from}</b>
        {to && <small>{to}</small>}
      </span>
      <span className="grow">
        <span className="item-title">
          {displayTitle(ev, occ.day)}
          {ev.rec_freq !== 'none' && ev.kind !== 'birthday' && <span className="muted"> ↻</span>}
        </span>
        <span className="sub">{[nameOf(ev.owner, members), ev.location].filter(Boolean).join(' · ')}</span>
      </span>
    </button>
  )
}

export function TaskRow({ task, showDue }: { task: Task; showDue?: boolean }) {
  const { members, openTask, toggleTask } = useStore()
  const late = !task.done && !!task.due_date && task.due_date < todayKey()
  return (
    <div className={task.done ? 'item done' : 'item'} style={tint(colorOf(task.owner, members))}>
      <button className={task.done ? 'check on' : 'check'} aria-label={task.done ? 'Marquer à faire' : 'Marquer comme fait'} onClick={() => toggleTask(task)}>
        {task.done && <Icon name="check" size={18} />}
      </button>
      <button className="grow plain" onClick={() => openTask(task)}>
        <span className="item-title">
          {task.title}
          {task.rec_freq !== 'none' && <span className="muted"> ↻</span>}
        </span>
        <span className="sub">
          {nameOf(task.owner, members)}
          {showDue && task.due_date && <span className={late ? 'late' : ''}> · {fmtShortDay(task.due_date)}</span>}
        </span>
      </button>
    </div>
  )
}

interface DayItemsProps {
  day: string
  occurrences: Occurrence[]
  tasks: Task[]
}

/** Tout ce qui se passe un jour donné : rendez-vous puis tâches. */
export function DayItems({ day, occurrences, tasks }: DayItemsProps) {
  return (
    <div className="items">
      {occurrences.map((occ) => (
        <EventRow key={`${occ.event.id}:${occ.day}`} occ={occ} day={day} />
      ))}
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  )
}

/** Jour férié et vacances scolaires d'un jour, s'il y en a. */
export function DayNote({ day }: { day: string }) {
  const { holiday, vacation } = useStore().dayInfo(day)
  if (!holiday && !vacation) return null
  return <p className="day-note">{[holiday && `Férié : ${holiday}`, vacation].filter(Boolean).join(' · ')}</p>
}

/** Écran ou liste vide : une petite illustration et une phrase. */
export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ico" aria-hidden="true">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  )
}
