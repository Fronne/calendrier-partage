import { displayTitle, eventIcon, type Occurrence, type Task } from '../../shared/types'
import { colorOf, nameOf } from '../colors'
import { fmtShortDay, occTimeLabel, todayKey } from '../dates'
import { useStore } from '../store'

export function EventRow({ occ, day }: { occ: Occurrence; day: string }) {
  const { members, openEvent } = useStore()
  const ev = occ.event
  const icon = eventIcon(ev)
  return (
    <button className="item" onClick={() => openEvent(occ)}>
      <span className="bar" style={{ background: colorOf(ev.owner, members) }} />
      <span className="time">{occTimeLabel(occ, day)}</span>
      <span className="grow">
        <span className="item-title">
          {icon && `${icon} `}
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
  const color = colorOf(task.owner, members)
  const late = !task.done && !!task.due_date && task.due_date < todayKey()
  return (
    <div className={task.done ? 'item done' : 'item'}>
      <button
        className="check"
        aria-label={task.done ? 'Marquer à faire' : 'Marquer comme fait'}
        style={{ borderColor: color, background: task.done ? color : 'transparent' }}
        onClick={() => toggleTask(task)}
      >
        {task.done && '✓'}
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
