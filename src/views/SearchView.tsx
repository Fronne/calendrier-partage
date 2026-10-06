import { useMemo } from 'react'
import { expand } from '../../shared/recurrence'
import { displayTitle, type CalEvent, type Task } from '../../shared/types'
import { EventRow, TaskRow } from '../components/Items'
import { addDays, fmtFullDay, todayKey } from '../dates'

interface Props {
  query: string
  events: CalEvent[]
  tasks: Task[]
}

/** Jusqu'où chercher la prochaine date d'un rendez-vous répété. */
const LOOK_AHEAD_DAYS = 730
const MAX_RESULTS = 50

// Sans majuscules ni accents : « cine » trouve « Cinéma »
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SearchView({ query, events, tasks }: Props) {
  const today = todayKey()
  const q = plain(query.trim())

  const results = useMemo(() => {
    if (q.length < 2) return null
    const found = events
      .filter((e) => plain(`${displayTitle(e)} ${e.location} ${e.notes}`).includes(q))
      // Prochaine date à venir ; à défaut (rendez-vous passé), sa date d'origine
      .map((e) => expand(e, today, addDays(today, LOOK_AHEAD_DAYS))[0] ?? expand(e, e.start_local.slice(0, 10), e.start_local.slice(0, 10))[0])
      .filter(Boolean)
    const upcoming = found.filter((o) => o.end.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start))
    const past = found.filter((o) => o.end.slice(0, 10) < today).sort((a, b) => b.start.localeCompare(a.start))
    return {
      occurrences: [...upcoming, ...past].slice(0, MAX_RESULTS),
      tasks: tasks.filter((t) => plain(t.title).includes(q)).slice(0, MAX_RESULTS),
    }
  }, [q, events, tasks, today])

  if (!results) return <p className="empty">Tapez au moins 2 lettres : titre, lieu ou note.</p>
  if (!results.occurrences.length && !results.tasks.length) return <p className="empty">Aucun résultat pour « {query.trim()} ».</p>

  return (
    <>
      {results.occurrences.map((occ) => {
        const day = occ.start.slice(0, 10)
        return (
          <section key={occ.event.id}>
            <h2 className="day-title">{fmtFullDay(day)}</h2>
            <EventRow occ={occ} day={day} />
          </section>
        )
      })}
      {results.tasks.length > 0 && (
        <>
          <h2 className="day-title">Tâches</h2>
          <div className="items">
            {results.tasks.map((t) => (
              <TaskRow key={t.id} task={t} showDue />
            ))}
          </div>
        </>
      )}
    </>
  )
}
