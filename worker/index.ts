import { Hono, type Context } from 'hono'
import { parseLocal } from '../shared/recurrence'
import { BOTH, CATEGORIES, displayTitle, eventIcon, FREQS, type CalEvent, type Freq, type Member, type SyncData } from '../shared/types'
import { codeMatches, makeToken, verifyToken } from './auth'
import { allEvents, allMembers, allTasks, getMeta, rowToEvent } from './db'
import type { Env } from './env'
import { schoolHolidays, ZONE_ACADEMY } from './holidays'
import { deliver, runReminders, type SubRow } from './reminders'

const MAX_MEMBERS = 2
const MAX_LOGIN_FAILS = 10
const LOGIN_WINDOW_MS = 15 * 60_000

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Ctx = Context<{ Bindings: Env; Variables: { memberId: string } }>

const bad = (message: string) => new HttpError(400, message)
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
// Le téléphone choisit l'identifiant : renvoyer deux fois la même création (réseau instable) ne crée pas de doublon
const idFrom = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : crypto.randomUUID())
const now = () => new Date().toISOString()

const app = new Hono<{ Bindings: Env; Variables: { memberId: string } }>()

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as any)
  console.error(err)
  return c.json({ error: 'Erreur du serveur.' }, 500)
})

app.post('/api/login', async (c) => {
  const env = c.env
  if (!env.COUPLE_CODE) throw new HttpError(500, "Le code de couple n'est pas configuré sur le serveur.")
  const b = await c.req.json().catch(() => ({}))

  // Frein contre les essais de code en série
  const bucket = 'login_fails:' + Math.floor(Date.now() / LOGIN_WINDOW_MS)
  if (Number((await getMeta(env, bucket)) ?? 0) >= MAX_LOGIN_FAILS) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.')
  }
  if (!(await codeMatches(env, String(b.code ?? '')))) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM meta WHERE key LIKE 'login_fails:%' AND key != ?").bind(bucket),
      env.DB.prepare(
        "INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1",
      ).bind(bucket),
    ])
    throw new HttpError(401, 'Code incorrect.')
  }

  const members = await allMembers(env)
  const name = text(b.name, 30)
  // Sans prénom : simple vérification du code, on renvoie qui est déjà inscrit
  if (!name) return c.json({ members, canCreate: members.length < MAX_MEMBERS })

  let member = members.find((m) => m.name.toLowerCase() === name.toLowerCase())
  if (!member) {
    if (members.length >= MAX_MEMBERS) throw new HttpError(409, 'Deux personnes utilisent déjà ce calendrier.')
    member = { id: crypto.randomUUID(), name, color: COLOR.test(b.color) ? b.color : '#2563eb', notify_changes: true }
    await env.DB.prepare('INSERT INTO members (id, name, color) VALUES (?, ?, ?)').bind(member.id, member.name, member.color).run()
  }
  return c.json({ token: await makeToken(env, member.id), member })
})

app.use('/api/*', async (c, next) => {
  const token = (c.req.header('Authorization') ?? '').replace(/^Bearer /, '')
  const memberId = await verifyToken(c.env, token)
  if (!memberId) throw new HttpError(401, 'Reconnectez-vous.')
  c.set('memberId', memberId)
  await next()
})

app.get('/api/sync', async (c) => {
  const [members, events, tasks] = await Promise.all([allMembers(c.env), allEvents(c.env), allTasks(c.env)])
  const me = c.get('memberId')
  if (!members.some((m) => m.id === me)) throw new HttpError(401, 'Reconnectez-vous.')
  return c.json({ me, members, events, tasks } satisfies SyncData)
})

app.put('/api/me', async (c) => {
  const b = await c.req.json()
  const name = text(b.name, 30)
  if (!name) throw bad('Le prénom est obligatoire.')
  if (!COLOR.test(b.color)) throw bad('Couleur invalide.')
  await c.env.DB.prepare('UPDATE members SET name = ?, color = ?, notify_changes = ? WHERE id = ?')
    .bind(name, b.color, b.notify_changes === false ? 0 : 1, c.get('memberId'))
    .run()
  return c.json({ ok: true })
})

app.get('/api/holidays', async (c) => {
  const zone = c.req.query('zone') ?? ''
  if (!(zone in ZONE_ACADEMY)) throw bad('Zone inconnue.')
  return c.json({ periods: await schoolHolidays(c.env, zone) })
})

// ---------- Notification de l'autre personne quand quelque chose change ----------

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

function whenLabel(local: string): string {
  const day = dayFmt.format(parseLocal(local))
  return local.length > 10 ? `${day} à ${local.slice(11)}` : day
}

const describe = (ev: CalEvent, start = ev.start_local) =>
  `${eventIcon(ev)} ${displayTitle(ev)}`.trim() + (ev.kind === 'birthday' ? '' : ` · ${whenLabel(start)}`)

/** `action` complète la phrase « Léa … » ; rien n'est envoyé pour une annulation (?silent=1). */
function notifyOther(c: Ctx, action: string, body: string) {
  if (c.req.query('silent')) return
  const me = c.get('memberId')
  c.executionCtx.waitUntil(
    (async () => {
      const members = await allMembers(c.env)
      const actor = members.find((m) => m.id === me)
      const targets = members.filter((m) => m.id !== me && m.notify_changes).map((m) => m.id)
      if (!actor || !targets.length) return
      const subs = (await c.env.DB.prepare('SELECT * FROM push_subscriptions').all<SubRow>()).results
      await deliver(c.env, subs.filter((s) => targets.includes(s.member_id)), {
        title: `${actor.name} ${action}`,
        body,
        tag: 'change:' + Date.now(),
      })
    })(),
  )
}

// ---------- Rendez-vous ----------

// `members` évite de relire la base à chaque élément quand on en traite beaucoup (restauration)
async function checkOwner(env: Env, owner: unknown, members?: Member[]): Promise<string> {
  if (owner === BOTH) return BOTH
  if (typeof owner === 'string' && (members ?? (await allMembers(env))).some((m) => m.id === owner)) return owner
  throw bad('Personne inconnue.')
}

function cleanRepeat(b: any, allowed: boolean) {
  const rec_freq: Freq = allowed && FREQS.includes(b.rec_freq) ? b.rec_freq : 'none'
  return { rec_freq, rec_interval: Math.min(99, Math.max(1, Math.round(Number(b.rec_interval)) || 1)) }
}

function cleanReminder(v: unknown): number | null {
  if (v == null) return null
  const minutes = Math.round(Number(v))
  if (!(minutes >= 0 && minutes <= 40320)) throw bad('Rappel invalide.')
  return minutes
}

async function cleanEvent(env: Env, b: any, members?: Member[]) {
  const title = text(b.title, 200)
  if (!title) throw bad('Le titre est obligatoire.')
  const birthday = b.kind === 'birthday'
  const all_day = birthday || !!b.all_day
  const fmt = all_day ? DATE : DATETIME
  if (!fmt.test(b.start_local) || !fmt.test(b.end_local)) throw bad('Date invalide.')
  const repeat = birthday ? { rec_freq: 'yearly' as Freq, rec_interval: 1 } : cleanRepeat(b, true)
  const birthYear = Math.round(Number(b.birth_year))
  return {
    title,
    start_local: b.start_local as string,
    end_local: (birthday || b.end_local < b.start_local ? b.start_local : b.end_local) as string,
    all_day: all_day ? 1 : 0,
    location: text(b.location, 200),
    notes: text(b.notes, 2000),
    owner: await checkOwner(env, b.owner, members),
    ...repeat,
    rec_until: !birthday && repeat.rec_freq !== 'none' && DATE.test(b.rec_until) ? (b.rec_until as string) : null,
    exdates: JSON.stringify(Array.isArray(b.exdates) ? b.exdates.filter((d: unknown) => typeof d === 'string' && DATE.test(d)).slice(0, 500) : []),
    reminder_minutes: cleanReminder(b.reminder_minutes),
    category: CATEGORIES.some((cat) => cat.id === b.category) ? (b.category as string) : '',
    kind: birthday ? 'birthday' : 'event',
    birth_year: birthday && birthYear >= 1900 && birthYear <= 2100 ? birthYear : null,
  }
}

type CleanEvent = Awaited<ReturnType<typeof cleanEvent>>

function insertEvent(env: Env, id: string, e: CleanEvent) {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO events (id, title, start_local, end_local, all_day, location, notes, owner, rec_freq,
       rec_interval, rec_until, exdates, reminder_minutes, category, kind, birth_year, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, e.title, e.start_local, e.end_local, e.all_day, e.location, e.notes, e.owner, e.rec_freq,
    e.rec_interval, e.rec_until, e.exdates, e.reminder_minutes, e.category, e.kind, e.birth_year, now())
}

const asEvent = (e: CleanEvent) => rowToEvent(e) as CalEvent

async function getEvent(env: Env, id: string): Promise<CalEvent | null> {
  const row = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first()
  return row ? rowToEvent(row) : null
}

app.post('/api/events', async (c) => {
  const b = await c.req.json()
  const e = await cleanEvent(c.env, b)
  const id = idFrom(b.id)
  const res = await insertEvent(c.env, id, e).run()
  if (res.meta.changes) notifyOther(c, e.kind === 'birthday' ? 'a ajouté un anniversaire' : 'a ajouté un rendez-vous', describe(asEvent(e)))
  return c.json({ id })
})

app.put('/api/events/:id', async (c) => {
  const e = await cleanEvent(c.env, await c.req.json())
  // Les occurrences supprimées n'ont plus de sens si la série a été déplacée
  const res = await c.env.DB.prepare(
    `UPDATE events SET title = ?, end_local = ?, all_day = ?, location = ?, notes = ?, owner = ?,
       rec_freq = ?, rec_interval = ?, rec_until = ?, reminder_minutes = ?, category = ?, kind = ?, birth_year = ?,
       updated_at = ?, exdates = CASE WHEN start_local = ? THEN exdates ELSE '[]' END, start_local = ?
     WHERE id = ?`,
  )
    .bind(e.title, e.end_local, e.all_day, e.location, e.notes, e.owner, e.rec_freq, e.rec_interval, e.rec_until,
      e.reminder_minutes, e.category, e.kind, e.birth_year, now(), e.start_local, e.start_local, c.req.param('id'))
    .run()
  if (!res.meta.changes) throw new HttpError(404, "Ce rendez-vous n'existe plus.")
  notifyOther(c, e.kind === 'birthday' ? 'a modifié un anniversaire' : 'a modifié un rendez-vous', describe(asEvent(e)))
  return c.json({ ok: true })
})

app.delete('/api/events/:id', async (c) => {
  const ev = await getEvent(c.env, c.req.param('id'))
  if (ev) {
    await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(ev.id).run()
    notifyOther(c, ev.kind === 'birthday' ? 'a supprimé un anniversaire' : 'a supprimé un rendez-vous', describe(ev))
  }
  return c.json({ ok: true })
})

async function setExdates(c: Ctx, change: (exdates: string[]) => string[]): Promise<CalEvent> {
  const ev = await getEvent(c.env, c.req.param('id')!)
  if (!ev) throw new HttpError(404, "Ce rendez-vous n'existe plus.")
  await c.env.DB.prepare('UPDATE events SET exdates = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(change(ev.exdates)), now(), ev.id)
    .run()
  return ev
}

// Supprime une seule date d'une série…
app.post('/api/events/:id/exdate', async (c) => {
  const { day } = await c.req.json()
  if (!DATE.test(day)) throw bad('Date invalide.')
  const ev = await setExdates(c, (ex) => [...new Set([...ex, day])])
  notifyOther(c, 'a supprimé une date', describe(ev, day + ev.start_local.slice(10)))
  return c.json({ ok: true })
})

// …ou la rétablit (annulation)
app.delete('/api/events/:id/exdate/:day', async (c) => {
  await setExdates(c, (ex) => ex.filter((d) => d !== c.req.param('day')))
  return c.json({ ok: true })
})

// Modifie une seule date d'une série : elle sort de la série et devient un rendez-vous à part
app.post('/api/events/:id/detach', async (c) => {
  const b = await c.req.json()
  if (!DATE.test(b.day)) throw bad('Date invalide.')
  const e = await cleanEvent(c.env, { ...b.event, rec_freq: 'none', exdates: [] })
  const series = await getEvent(c.env, c.req.param('id'))
  if (!series) throw new HttpError(404, "Ce rendez-vous n'existe plus.")
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE events SET exdates = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify([...new Set([...series.exdates, b.day])]), now(), series.id),
    insertEvent(c.env, idFrom(b.event?.id), e),
  ])
  notifyOther(c, 'a modifié un rendez-vous', describe(asEvent(e)))
  return c.json({ ok: true })
})

// ---------- Tâches ----------

async function cleanTask(env: Env, b: any, members?: Member[]) {
  const title = text(b.title, 200)
  if (!title) throw bad('Le titre est obligatoire.')
  const done = !!b.done
  const due_date = DATE.test(b.due_date) ? (b.due_date as string) : null
  return {
    title,
    due_date,
    owner: await checkOwner(env, b.owner, members),
    done: done ? 1 : 0,
    done_at: done ? now() : null,
    // Répétition et rappel n'ont de sens qu'avec une échéance
    ...cleanRepeat(b, !!due_date),
    reminder_minutes: due_date ? cleanReminder(b.reminder_minutes) : null,
  }
}

type CleanTask = Awaited<ReturnType<typeof cleanTask>>

function insertTask(env: Env, id: string, t: CleanTask) {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO tasks (id, title, due_date, owner, done, done_at, rec_freq, rec_interval, reminder_minutes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, t.title, t.due_date, t.owner, t.done, t.done_at, t.rec_freq, t.rec_interval, t.reminder_minutes, now())
}

app.post('/api/tasks', async (c) => {
  const b = await c.req.json()
  const t = await cleanTask(c.env, b)
  const id = idFrom(b.id)
  const res = await insertTask(c.env, id, t).run()
  if (res.meta.changes) notifyOther(c, 'a ajouté une tâche', t.due_date ? `${t.title} · pour le ${whenLabel(t.due_date)}` : t.title)
  return c.json({ id })
})

app.put('/api/tasks/:id', async (c) => {
  const t = await cleanTask(c.env, await c.req.json())
  const res = await c.env.DB.prepare(
    `UPDATE tasks SET title = ?, due_date = ?, owner = ?, done = ?, done_at = ?, rec_freq = ?, rec_interval = ?,
       reminder_minutes = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(t.title, t.due_date, t.owner, t.done, t.done_at, t.rec_freq, t.rec_interval, t.reminder_minutes, now(), c.req.param('id'))
    .run()
  if (!res.meta.changes) throw new HttpError(404, "Cette tâche n'existe plus.")
  return c.json({ ok: true })
})

app.delete('/api/tasks/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---------- Restauration d'une sauvegarde ----------

const RESTORE_MAX = 5000
const BATCH_SIZE = 50

// Remet ce qui manque à partir d'un fichier exporté. Ce qui existe déjà (même identifiant) n'est pas touché.
app.post('/api/restore', async (c) => {
  const b = await c.req.json()
  const lists = { events: Array.isArray(b.events) ? b.events : [], tasks: Array.isArray(b.tasks) ? b.tasks : [] }
  if (lists.events.length + lists.tasks.length > RESTORE_MAX) throw bad('Fichier trop volumineux.')

  const members = await allMembers(c.env)
  const statements: D1PreparedStatement[] = []
  let skipped = 0
  for (const [kind, items] of Object.entries(lists)) {
    for (const item of items) {
      try {
        if (!UUID.test(item?.id)) throw bad('Identifiant invalide.')
        statements.push(kind === 'events' ? insertEvent(c.env, item.id, await cleanEvent(c.env, item, members)) : insertTask(c.env, item.id, await cleanTask(c.env, item, members)))
      } catch {
        skipped++
      }
    }
  }

  let restored = 0
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const results = await c.env.DB.batch(statements.slice(i, i + BATCH_SIZE))
    restored += results.reduce((n, r) => n + (r.meta.changes ?? 0), 0)
  }
  return c.json({ restored, already: statements.length - restored, skipped })
})

// ---------- Notifications ----------

app.get('/api/push/key', (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) throw new HttpError(500, 'Les notifications ne sont pas configurées sur le serveur.')
  return c.json({ key: c.env.VAPID_PUBLIC_KEY })
})

app.post('/api/push/subscribe', async (c) => {
  const b = await c.req.json()
  const endpoint = String(b.endpoint ?? '')
  if (!endpoint.startsWith('https://') || !b.keys?.p256dh || !b.keys?.auth) throw bad('Abonnement invalide.')
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, member_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, member_id = excluded.member_id`,
  )
    .bind(endpoint, String(b.keys.p256dh), String(b.keys.auth), c.get('memberId'))
    .run()
  return c.json({ ok: true })
})

app.post('/api/push/unsubscribe', async (c) => {
  const { endpoint } = await c.req.json()
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?')
    .bind(String(endpoint ?? ''), c.get('memberId'))
    .run()
  return c.json({ ok: true })
})

app.post('/api/push/test', async (c) => {
  const subs = (
    await c.env.DB.prepare('SELECT * FROM push_subscriptions WHERE member_id = ?').bind(c.get('memberId')).all<SubRow>()
  ).results
  const sent = await deliver(c.env, subs, { title: 'Calendrier partagé', body: 'Les rappels fonctionnent sur ce téléphone.', tag: 'test' })
  return c.json({ sent, total: subs.length })
})

app.all('/api/*', () => {
  throw new HttpError(404, 'Introuvable.')
})

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env))
  },
}
