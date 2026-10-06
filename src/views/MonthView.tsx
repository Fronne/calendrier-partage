import { useMemo, useRef, useState } from 'react'
import { displayTitle, eventIcon, type CalEvent, type Task } from '../../shared/types'
import { colorOf } from '../colors'
import { DayItems, DayNote } from '../components/Items'
import { addMonths, fmtLongDay, fmtMonth, monthGrid, monthStart, occurrencesByDay, todayKey } from '../dates'
import { useStore } from '../store'

interface Props {
  events: CalEvent[]
  tasks: Task[]
  selectedDay: string
  onSelectDay: (day: string) => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
/** Nombre de titres affichés dans une case avant « +n ». */
const MAX_LINES = 2
const SWIPE_PX = 60

export default function MonthView({ events, tasks, selectedDay, onSelectDay }: Props) {
  const { members, dayInfo } = useStore()
  const [month, setMonth] = useState(() => monthStart(selectedDay))
  const touchX = useRef<number | null>(null)
  const today = todayKey()

  const grid = useMemo(() => monthGrid(month), [month])
  const byDay = useMemo(() => occurrencesByDay(events, grid[0], grid[grid.length - 1]), [events, grid])
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) if (t.due_date) map.set(t.due_date, [...(map.get(t.due_date) ?? []), t])
    return map
  }, [tasks])

  const go = (n: number) => setMonth((m) => addMonths(m, n))
  const select = (day: string) => {
    onSelectDay(day)
    if (monthStart(day) !== month) setMonth(monthStart(day))
  }

  const dayOccs = byDay.get(selectedDay) ?? []
  const dayTasks = tasksByDay.get(selectedDay) ?? []

  return (
    <>
      <div className="month-head">
        <button aria-label="Mois précédent" onClick={() => go(-1)}>
          ‹
        </button>
        <strong>{fmtMonth(month)}</strong>
        <button aria-label="Mois suivant" onClick={() => go(1)}>
          ›
        </button>
        <button className="today-btn" onClick={() => select(today)}>
          Aujourd'hui
        </button>
      </div>

      <div
        className="grid"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
        }}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="weekday">
            {d}
          </span>
        ))}
        {grid.map((day) => {
          const info = dayInfo(day)
          const lines = [
            ...(byDay.get(day) ?? []).map((o) => ({
              key: o.event.id,
              label: `${eventIcon(o.event)} ${displayTitle(o.event)}`.trim(),
              color: colorOf(o.event.owner, members),
              task: false,
            })),
            ...(tasksByDay.get(day) ?? []).filter((t) => !t.done).map((t) => ({ key: t.id, label: t.title, color: colorOf(t.owner, members), task: true })),
          ]
          const cls = [
            'cell',
            monthStart(day) !== month && 'out',
            day === today && 'today',
            day === selectedDay && 'selected',
            info.holiday && 'holiday',
            info.vacation && 'vacation',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button key={day} className={cls} onClick={() => select(day)}>
              <span className="num">{Number(day.slice(8))}</span>
              {lines.slice(0, MAX_LINES).map((l) => (
                <span key={l.key} className={l.task ? 'pill task' : 'pill'} style={l.task ? { borderColor: l.color, color: l.color } : { background: l.color }}>
                  {l.label}
                </span>
              ))}
              {lines.length > MAX_LINES && <span className="more">+{lines.length - MAX_LINES}</span>}
            </button>
          )
        })}
      </div>

      <h2 className="day-title">{fmtLongDay(selectedDay)}</h2>
      <DayNote day={selectedDay} />
      {dayOccs.length + dayTasks.length === 0 ? (
        <p className="empty">Rien de prévu ce jour-là.</p>
      ) : (
        <DayItems day={selectedDay} occurrences={dayOccs} tasks={dayTasks} />
      )}
    </>
  )
}
