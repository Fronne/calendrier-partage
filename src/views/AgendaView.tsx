import { useMemo, useState } from 'react'
import type { CalEvent, Task } from '../../shared/types'
import { DayItems, DayNote, TaskRow } from '../components/Items'
import { addDays, fmtLongDay, occurrencesByDay, todayKey } from '../dates'

interface Props {
  events: CalEvent[]
  tasks: Task[]
}

/** Période affichée, et de combien « Voir plus loin » l'allonge. */
const DAYS_STEP = 90

export default function AgendaView({ events, tasks }: Props) {
  const today = todayKey()
  const [daysAhead, setDaysAhead] = useState(DAYS_STEP)

  const days = useMemo(() => {
    const to = addDays(today, daysAhead)
    const byDay = occurrencesByDay(events, today, to)
    const out = []
    for (let d = today; d <= to; d = addDays(d, 1)) {
      const occurrences = byDay.get(d) ?? []
      const dayTasks = tasks.filter((t) => t.due_date === d && !t.done)
      if (occurrences.length || dayTasks.length) out.push({ day: d, occurrences, tasks: dayTasks })
    }
    return out
  }, [events, tasks, today, daysAhead])

  const late = tasks.filter((t) => !t.done && t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!))

  const further = (
    <button className="secondary wide" onClick={() => setDaysAhead((d) => d + DAYS_STEP)}>
      Voir plus loin
    </button>
  )

  if (!days.length && !late.length) {
    return (
      <>
        <p className="empty">Rien de prévu dans les {Math.round(daysAhead / 30)} prochains mois.</p>
        {further}
      </>
    )
  }

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
      {further}
    </>
  )
}
