import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { displayTitle, eventIcon, type CalEvent, type Occurrence, type Task } from '../../shared/types'
import { colorOf, tint } from '../colors'
import { DayItems, DayNote, Empty } from '../components/Items'
import { addDays, fmtLongDay, fmtRange, minutesOf, mondayOf, occurrencesByDay, todayKey } from '../dates'
import { useStore } from '../store'

interface Props {
  events: CalEvent[]
  tasks: Task[]
  selectedDay: string
  onSelectDay: (day: string) => void
  onNewEvent: (day: string, time: string) => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
/** Hauteur d'une heure, en pixels. */
const HOUR_H = 44
/** Heure affichée en haut à l'ouverture. */
const FIRST_HOUR = 7
const MIN_BLOCK_MIN = 30
const SWIPE_PX = 60
/** Décalage maximal entre deux rendez-vous simultanés, en % de la largeur du jour. */
const MAX_LANE_SHIFT = 26
/** Part du jour que le dernier rendez-vous d'une cascade garde toujours. */
const MIN_BLOCK_WIDTH = 45

interface Block {
  occ: Occurrence
  from: number
  to: number
  lane: number
}

/** Sépare ce qui occupe toute la journée de ce qui a un horaire, et range en colonnes ce qui se chevauche. */
function layout(occs: Occurrence[], day: string) {
  const allDay: Occurrence[] = []
  const blocks: Block[] = []
  for (const occ of occs) {
    const from = occ.event.all_day || occ.start.slice(0, 10) < day ? 0 : minutesOf(occ.start)
    const to = occ.event.all_day || occ.end.slice(0, 10) > day ? 1440 : minutesOf(occ.end)
    if (from === 0 && to === 1440) allDay.push(occ)
    else blocks.push({ occ, from, to: Math.max(to, from + MIN_BLOCK_MIN), lane: 0 })
  }
  blocks.sort((a, b) => a.from - b.from)
  const laneEnds: number[] = []
  for (const b of blocks) {
    let lane = laneEnds.findIndex((end) => end <= b.from)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = b.to
    b.lane = lane
  }
  return { allDay, blocks, lanes: Math.max(1, laneEnds.length) }
}

export default function WeekView({ events, tasks, selectedDay, onSelectDay, onNewEvent }: Props) {
  const { members, dayInfo, openEvent, openTask } = useStore()
  const scroller = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)
  const today = todayKey()
  const monday = mondayOf(selectedDay)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const { columns, byDay } = useMemo(() => {
    const byDay = occurrencesByDay(events, days[0], days[6])
    const columns = days.map((day) => ({ day, ...layout(byDay.get(day) ?? [], day), tasks: tasks.filter((t) => t.due_date === day && !t.done) }))
    return { columns, byDay }
  }, [events, tasks, days])

  const dayOccs = byDay.get(selectedDay) ?? []
  const dayTasks = tasks.filter((t) => t.due_date === selectedDay)

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = FIRST_HOUR * HOUR_H
  }, [])

  const tapEmpty = (e: MouseEvent<HTMLDivElement>, day: string) => {
    if (e.target !== e.currentTarget) return
    const hour = Math.min(23, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_H))
    onNewEvent(day, `${String(hour).padStart(2, '0')}:00`)
  }

  const label = (occ: Occurrence) => (
    <>
      {eventIcon(occ.event) && <span className="ico">{eventIcon(occ.event)}</span>}
      {displayTitle(occ.event)}
    </>
  )

  return (
    <>
      <div className="month-head">
        <button aria-label="Semaine précédente" onClick={() => onSelectDay(addDays(selectedDay, -7))}>
          ‹
        </button>
        <label className="pick" aria-label="Choisir une date">
          <strong>{fmtRange(days[0], days[6])} ▾</strong>
          <input type="date" value={selectedDay} onChange={(e) => e.target.value && onSelectDay(e.target.value)} />
        </label>
        <button aria-label="Semaine suivante" onClick={() => onSelectDay(addDays(selectedDay, 7))}>
          ›
        </button>
        <button className="today-btn" aria-label="Revenir à aujourd'hui" onClick={() => onSelectDay(today)}>
          {Number(today.slice(8))}
        </button>
      </div>

      <div
        className="week"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > SWIPE_PX) onSelectDay(addDays(selectedDay, dx < 0 ? 7 : -7))
        }}
      >
        <div className="week-row week-days">
          <span />
          {days.map((day, i) => {
            const info = dayInfo(day)
            const cls = ['week-day', day === today && 'today', day === selectedDay && 'selected', info.holiday && 'holiday', info.vacation && 'vacation'].filter(Boolean).join(' ')
            return (
              <button key={day} className={cls} onClick={() => onSelectDay(day)}>
                <small>{WEEKDAYS[i]}</small>
                <span className="num">{Number(day.slice(8))}</span>
              </button>
            )
          })}
        </div>

        <div className="week-row week-allday">
          <span />
          {columns.map((col) => {
            const holiday = dayInfo(col.day).holiday
            return (
              <div key={col.day} className="week-stack">
                {holiday && <span className="pill holiday-pill">{holiday}</span>}
                {col.allDay.map((occ) => (
                  <button key={occ.event.id} className="pill" style={tint(colorOf(occ.event.owner, members))} onClick={() => openEvent(occ)}>
                    {label(occ)}
                  </button>
                ))}
                {col.tasks.map((t) => (
                  <button key={t.id} className="pill task" style={tint(colorOf(t.owner, members))} onClick={() => openTask(t)}>
                    {t.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        <div className="week-scroll" ref={scroller}>
          <div className="week-row week-hours" style={{ height: 24 * HOUR_H, backgroundSize: `100% ${HOUR_H}px` }}>
            <div className="hour-labels">
              {Array.from({ length: 23 }, (_, i) => (
                <span key={i} style={{ top: (i + 1) * HOUR_H }}>
                  {i + 1} h
                </span>
              ))}
            </div>
            {columns.map((col) => {
              // Chaque rendez-vous simultané est décalé vers la droite et passe au-dessus du précédent
              const shift = col.lanes > 1 ? Math.min(MAX_LANE_SHIFT, (100 - MIN_BLOCK_WIDTH) / (col.lanes - 1)) : 0
              return (
              <div key={col.day} className={col.day === today ? 'week-col today' : 'week-col'} onClick={(e) => tapEmpty(e, col.day)}>
                {col.blocks.map((b) => (
                  <button
                    key={`${b.occ.event.id}:${b.occ.day}`}
                    className="block"
                    style={{
                      top: (b.from / 60) * HOUR_H,
                      height: ((b.to - b.from) / 60) * HOUR_H - 1,
                      left: `${b.lane * shift}%`,
                      width: `${100 - b.lane * shift}%`,
                      zIndex: b.lane + 1,
                      ...tint(colorOf(b.occ.event.owner, members)),
                    }}
                    onClick={() => openEvent(b.occ)}
                  >
                    {label(b.occ)}
                  </button>
                ))}
              </div>
              )
            })}
          </div>
        </div>
      </div>

      <h2 className="day-title">{fmtLongDay(selectedDay)}</h2>
      <DayNote day={selectedDay} />
      {dayOccs.length + dayTasks.length === 0 ? (
        <Empty icon="🌤️">Rien de prévu ce jour-là. Touchez un créneau vide pour ajouter un rendez-vous.</Empty>
      ) : (
        <DayItems day={selectedDay} occurrences={dayOccs} tasks={dayTasks} />
      )}
    </>
  )
}
