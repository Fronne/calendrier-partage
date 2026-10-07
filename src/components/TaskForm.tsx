import { useRef, useState } from 'react'
import { BOTH, type Task } from '../../shared/types'
import { errorText } from '../api'
import { uid } from '../ops'
import { useStore } from '../store'
import Choice from './Choice'
import { repeatKey, REPEATS } from './EventForm'
import OwnerPicker from './OwnerPicker'
import ReminderPicker, { NO_REMINDER, reminderFrom, type Reminder } from './ReminderPicker'
import Sheet, { FormError } from './Sheet'

interface Props {
  task?: Task
  onClose: () => void
}

export default function TaskForm({ task, onClose }: Props) {
  const { members, mutate, toast } = useStore()
  const [title, setTitle] = useState(task?.title ?? '')
  const [due, setDue] = useState(task?.due_date ?? '')
  const [owner, setOwner] = useState(task?.owner ?? BOTH)
  const [repeat, setRepeat] = useState(task ? repeatKey(task.rec_freq, task.rec_interval) : 'none')
  const [reminder, setReminder] = useState<Reminder>(() => (task ? reminderFrom(task, null) : NO_REMINDER))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const snapshot = JSON.stringify([title, due, owner, repeat, reminder])
  const dirty = snapshot !== useRef(snapshot).current

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      onClose()
      done?.()
      return true
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
      return false
    }
  }

  const refuse = (message: string) => {
    setError(message)
    return false
  }

  /** Renvoie false si rien n'a été enregistré : le panneau, s'il avait été écarté d'un geste, revient. */
  const save = () => {
    if (!title.trim()) return refuse('Décrivez la tâche.')
    if (!due && (repeat !== 'none' || reminder.minutes != null)) return refuse('Choisissez une date pour répéter la tâche ou recevoir un rappel.')
    const rep = REPEATS.find((r) => r.key === repeat) ?? REPEATS[0]
    const body = {
      title: title.trim(),
      due_date: due || null,
      owner,
      done: task?.done ?? false,
      rec_freq: rep.freq,
      rec_interval: rep.interval,
      reminder_minutes: reminder.minutes,
      reminder_time: reminder.time,
    }
    return run(() => (task ? mutate({ method: 'PUT', path: `/tasks/${task.id}`, body }) : mutate({ method: 'POST', path: '/tasks', body: { ...body, id: uid() } })))
  }

  const remove = () =>
    run(
      () => mutate({ method: 'DELETE', path: `/tasks/${task!.id}` }),
      () => toast('Tâche supprimée', () => mutate({ method: 'POST', path: '/tasks', body: task, silent: true }).catch(() => {})),
    )

  return (
    <Sheet title={task ? 'Tâche' : 'Nouvelle tâche'} busy={busy} dirty={dirty} onClose={onClose} onSubmit={save}>
      <input className="title-input" placeholder="À faire…" aria-label="Tâche" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus={!task} />
      <FormError text={error} />

      <div className="group">
      <label className="row">
        <span>Pour le (facultatif)</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>

      <div className="row">
        <span>Répéter</span>
        <Choice label="Répéter" value={repeat} options={REPEATS.map((r) => ({ value: r.key, label: r.label }))} onChange={setRepeat} />
      </div>
      {repeat !== 'none' && <p className="hint">Une fois cochée, la tâche revient à son échéance suivante.</p>}

      <ReminderPicker value={reminder} timed={false} onChange={setReminder} />
      </div>

      <div className="field">
        <span className="label">Pour qui</span>
        <OwnerPicker value={owner} members={members} onChange={setOwner} />
      </div>

      {task && (
        <button type="button" className="danger" disabled={busy} onClick={remove}>
          Supprimer
        </button>
      )}
    </Sheet>
  )
}
