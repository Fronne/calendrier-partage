import { useState, type FormEvent } from 'react'
import { BOTH, type Task } from '../../shared/types'
import { errorText } from '../api'
import Icon from '../components/Icon'
import { Empty, TaskRow } from '../components/Items'
import { uid } from '../ops'
import { useStore } from '../store'

/** Combien de tâches terminées restent affichées. */
const DONE_SHOWN = 20

export default function TasksView({ tasks }: { tasks: Task[] }) {
  const { mutate, toast } = useStore()
  const [title, setTitle] = useState('')
  const [showDone, setShowDone] = useState(false)

  // À faire : d'abord celles qui ont une échéance, par date ; les autres ensuite
  const todo = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.updated_at.localeCompare(b.updated_at))
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
    .slice(0, DONE_SHOWN)

  const quickAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const body = { id: uid(), title: title.trim(), due_date: null, owner: BOTH, done: false, rec_freq: 'none', rec_interval: 1, reminder_minutes: null, reminder_time: null }
    setTitle('')
    mutate({ method: 'POST', path: '/tasks', body }).catch((err) => toast(errorText(err)))
  }

  return (
    <>
      <form className="quick-add" onSubmit={quickAdd}>
        <input placeholder="Ajouter une tâche…" aria-label="Nouvelle tâche" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <button className="primary" disabled={!title.trim()}>
          Ajouter
        </button>
      </form>

      {todo.length === 0 && <Empty icon="✅">Aucune tâche à faire.</Empty>}
      <div className="items">
        {todo.map((t) => (
          <TaskRow key={t.id} task={t} showDue />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <button className="fold" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            <Icon name={showDone ? 'down' : 'right'} size={16} />
            Terminées ({done.length})
          </button>
          {showDone && (
            <div className="items">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
