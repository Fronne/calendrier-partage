import { useMemo } from 'react'
import type { CalEvent, Task } from '../../shared/types'
import { DayItems, DayNote, TaskRow } from '../components/Items'
import { addDays, fmtLongDay, occurrencesByDay, todayKey } from '../dates'

interface Props {
  events: CalEvent[]
  tasks: Task[]
}

const DAYS_AHEAD = 90

export default function AgendaView({ events, tasks }: Props) {
  const today = todayKey()

  const days = useMemo(() => {
    const to = addDays(today, DAYS_AHEAD)
    const byDay = occurrencesByDay(events, today, to)
    const out = []
    for (let d = today; d <= to; d = addDays(d, 1)) {
      const occurrences = byDay.get(d) ?? []
      const dayTasks = tasks.filter((t) => t.due_date === d && !t.done)
      if (occurrences.length || dayTasks.length) out.push({ day: d, occurrences, tasks: dayTasks })
    }
    return out
  }, [events, tasks, today])

  const late = tasks.filter((t) => !t.done && t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))

  if (!days.length && !late.length) return <p className="empty">Rien de prévu dans les 3 prochains mois.</p>

  return (
    <>
      {late.length > 0 && (
        <section>
          <h2 className="day-title late">En retard</h2>
          <div className="items">
            {late.map((t) => (
              <TaskRow key={t.id} task={t} showDue />
            ))}
          </div>
        </section>
      )}
      {days.map((d) => (
        <section key={d.day}>
          <h2 className="day-title">{fmtLongDay(d.day)}</h2>
          <DayNote day={d.day} />
          <DayItems {...d} />
        </section>
      ))}
    </>
  )
}
