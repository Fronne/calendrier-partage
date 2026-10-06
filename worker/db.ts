import type { CalEvent, Member, Task } from '../shared/types'
import type { Env } from './env'

export function rowToEvent(r: any): CalEvent {
  return { ...r, all_day: !!r.all_day, exdates: JSON.parse(r.exdates || '[]') }
}

export function rowToTask(r: any): Task {
  return { ...r, done: !!r.done }
}

export async function allMembers(env: Env): Promise<Member[]> {
  const rows = (await env.DB.prepare('SELECT id, name, color, notify_changes FROM members ORDER BY rowid').all<any>()).results
  return rows.map((r) => ({ ...r, notify_changes: !!r.notify_changes }))
}

export async function allEvents(env: Env): Promise<CalEvent[]> {
  return (await env.DB.prepare('SELECT * FROM events').all()).results.map(rowToEvent)
}

export async function allTasks(env: Env): Promise<Task[]> {
  return (await env.DB.prepare('SELECT * FROM tasks').all()).results.map(rowToTask)
}

export async function getMeta(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? null
}

export async function setMeta(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value)
    .run()
}
