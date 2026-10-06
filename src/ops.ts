import type { SyncData } from '../shared/types'

/** Une modification à envoyer au serveur. Gardée en file d'attente tant qu'il n'y a pas de réseau. */
export interface Op {
  id: string
  method: 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: any
  /** Annulation d'une action : ne prévient pas l'autre personne */
  silent?: boolean
}

export function uid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  // Navigateurs plus anciens
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Reproduit localement l'effet d'une modification en attente, pour l'afficher avant que le serveur la reçoive. */
export function applyOp(data: SyncData, op: Op): SyncData {
  const [kind, id, sub, arg] = op.path.split('/').filter(Boolean)
  const stamp = new Date().toISOString()
  const b = op.body

  if (kind === 'events') {
    let events = data.events
    if (op.method === 'POST' && !id) {
      if (!events.some((e) => e.id === b.id)) events = [...events, { ...b, exdates: b.exdates ?? [], updated_at: stamp }]
    } else if (op.method === 'PUT') {
      events = events.map((e) => (e.id === id ? { ...e, ...b, id, exdates: b.start_local === e.start_local ? e.exdates : [], updated_at: stamp } : e))
    } else if (op.method === 'DELETE' && !sub) {
      events = events.filter((e) => e.id !== id)
    } else if (sub === 'exdate') {
      events = events.map((e) =>
        e.id !== id ? e : { ...e, exdates: op.method === 'POST' ? [...e.exdates, b.day] : e.exdates.filter((d) => d !== arg) },
      )
    } else if (sub === 'detach') {
      events = [
        ...events.map((e) => (e.id !== id ? e : { ...e, exdates: [...e.exdates, b.day] })),
        { ...b.event, rec_freq: 'none', exdates: [], updated_at: stamp },
      ]
    }
    return { ...data, events }
  }

  if (kind === 'tasks') {
    let tasks = data.tasks
    if (op.method === 'POST') {
      if (!tasks.some((t) => t.id === b.id)) tasks = [...tasks, { ...b, done_at: null, updated_at: stamp }]
    } else if (op.method === 'PUT') {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...b, id, done_at: b.done ? (t.done_at ?? stamp) : null } : t))
    } else {
      tasks = tasks.filter((t) => t.id !== id)
    }
    return { ...data, tasks }
  }

  if (kind === 'me') {
    return { ...data, members: data.members.map((m) => (m.id === data.me ? { ...m, ...b } : m)) }
  }
  return data
}
