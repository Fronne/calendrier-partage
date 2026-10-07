import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { displayTitle, eventIcon, type CalEvent, type Task } from '../../shared/types'
import { colorOf, tint } from '../colors'
import Icon from '../components/Icon'
import { DayItems, DayNote, Empty } from '../components/Items'
import { addMonths, fmtLongDay, fmtMonth, isoWeek, monthGrid, monthStart, occurrencesByDay, todayKey } from '../dates'
import { useStore } from '../store'

interface Props {
  events: CalEvent[]
  tasks: Task[]
  selectedDay: string
  onSelectDay: (day: string) => void
  /** Affiche le numéro de chaque semaine dans une colonne à gauche */
  weekNums: boolean
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
/** Nombre de titres affichés dans une case avant « +n ». */
const MAX_LINES = 2
const SWIPE_PX = 60
/** Hauteur d'une ligne quand un jour affiche « +n » : en dessous, la grille passe en cases compactes. */
const ROOMY_ROW = 88
const MIN_ROW = 64
const MAX_ROW = 80

export default function MonthView({ events, tasks, selectedDay, onSelectDay, weekNums }: Props) {
  const { members, dayInfo } = useStore()
  const [month, setMonth] = useState(() => monthStart(selectedDay))
  const touchX = useRef<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  /** Hauteur imposée aux lignes quand le mois ne tient pas à l'écran ; null : hauteur habituelle. */
  const [rowH, setRowH] = useState<number | null>(null)
  const today = todayKey()

  const grid = useMemo(() => monthGrid(month), [month])
  const byDay = useMemo(() => occurrencesByDay(events, grid[0], grid[grid.length - 1]), [events, grid])
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) if (t.due_date) map.set(t.due_date, [...(map.get(t.due_date) ?? []), t])
    return map
  }, [tasks])

  // Le mois entier doit rester visible au-dessus du menu, même quand il s'étale sur six semaines
  useLayoutEffect(() => {
    const measure = () => {
      const cell = gridRef.current?.querySelector('.cell')
      const nav = document.querySelector('.bottomnav')
      if (!cell || !nav) return
      const rows = grid.length / 7
      const top = cell.getBoundingClientRect().top + window.scrollY
      const bottom = nav.getBoundingClientRect().top - 18
      const h = Math.floor((bottom - top - (rows - 1) * 2) / rows)
      setRowH(h >= ROOMY_ROW ? null : Math.min(MAX_ROW, Math.max(MIN_ROW, h)))
    }
    measure()
    window.addEventListener('resize', measure)
    const topbar = document.querySelector('.topbar')
    const observer = new ResizeObserver(measure)
    if (topbar) observer.observe(topbar)
    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [grid.length])

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
        <label className="pick">
          <strong>
            {fmtMonth(month)}
            <Icon name="down" size={16} className="caret" />
          </strong>
          <input type="month" aria-label="Choisir un mois" value={month.slice(0, 7)} onChange={(e) => e.target.value && select(e.target.value + '-01')} />
        </label>
        {(selectedDay !== today || month !== monthStart(today)) && (
          <button className="today-btn" onClick={() => select(today)}>
            Aujourd'hui
          </button>
        )}
        <button aria-label="Mois précédent" onClick={() => go(-1)}>
          <Icon name="left" />
        </button>
        <button aria-label="Mois suivant" onClick={() => go(1)}>
          <Icon name="right" />
        </button>
      </div>

      <div
        ref={gridRef}
        className={['grid', rowH != null && 'compact', weekNums && 'weeknums'].filter(Boolean).join(' ')}
        style={rowH == null ? undefined : ({ '--row-h': `${rowH}px` } as CSSProperties)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
        }}
      >
        {weekNums && <span aria-hidden="true" />}
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {grid.map((day, i) => {
          const info = dayInfo(day)
          const lines = [
            ...(byDay.get(day) ?? []).map((o) => ({
              key: o.event.id,
              icon: eventIcon(o.event),
              label: displayTitle(o.event),
              color: colorOf(o.event.owner, members),
              task: false,
            })),
            ...(tasksByDay.get(day) ?? []).filter((t) => !t.done).map((t) => ({ key: t.id, icon: '', label: t.title, color: colorOf(t.owner, members), task: true })),
          ]
          const pill = (l: (typeof lines)[number]) => (
            <span key={l.key} className={l.task ? 'pill task' : 'pill'} style={tint(l.color)}>
              {l.icon && <span className="ico">{l.icon}</span>}
              {l.label}
            </span>
          )
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
            <Fragment key={day}>
              {weekNums && i % 7 === 0 && (
                <span className="weeknum" aria-label={`Semaine ${isoWeek(day)}`}>
                  {isoWeek(day)}
                </span>
              )}
              <button
                className={cls}
                aria-label={[fmtLongDay(day), info.holiday, lines.length > 0 && `${lines.length} élément${lines.length > 1 ? 's' : ''}`].filter(Boolean).join(', ')}
                aria-current={day === today ? 'date' : undefined}
                aria-pressed={day === selectedDay}
                onClick={() => select(day)}
              >
                <span className="num">{Number(day.slice(8))}</span>
                {lines.slice(0, MAX_LINES - 1).map(pill)}
                {lines.length >= MAX_LINES && (
                  <span className="last">
                    {pill(lines[MAX_LINES - 1])}
                    {lines.length > MAX_LINES && <span className="more">+{lines.length - MAX_LINES}</span>}
                  </span>
                )}
              </button>
            </Fragment>
          )
        })}
      </div>

      <h2 className="day-title">{fmtLongDay(selectedDay)}</h2>
      <DayNote day={selectedDay} />
      {dayOccs.length + dayTasks.length === 0 ? (
        <Empty icon="🌤️">Rien de prévu ce jour-là.</Empty>
      ) : (
        <DayItems day={selectedDay} occurrences={dayOccs} tasks={dayTasks} />
      )}
    </>
  )
}
