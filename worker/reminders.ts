import { dueReminders, fmtLocal, parseLocal } from '../shared/recurrence'
import { BOTH, displayTitle, eventIcon, type CalEvent, type Occurrence, type Task } from '../shared/types'
import { allEvents, allTasks, getMeta, setMeta } from './db'
import type { Env } from './env'
import { sendPush, type PushSub } from './push'

const LAST_RUN = 'last_reminder_run'
/** Si le cron a été interrompu, on ne rattrape pas plus loin que ça. */
const MAX_CATCH_UP = 15 * 60_000

/** Heure murale dans le fuseau du couple, à la minute. */
export function localNow(tz: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const p = (t: string) => parts.find((x) => x.type === t)!.value
  return parseLocal(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`)
}

function message(occ: Occurrence) {
  const ev = occ.event
  const min = ev.reminder_minutes ?? 0
  let when: string
  if (ev.all_day) {
    const days = Math.round(min / 1440)
    when = days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`
  } else if (min === 0) when = `Maintenant · ${occ.start.slice(11)}`
  else if (min >= 1440) when = `Demain à ${occ.start.slice(11)}`
  else when = `À ${occ.start.slice(11)}`
  return {
    title: `${eventIcon(ev)} ${displayTitle(ev, occ.day)}`.trim(),
    body: ev.location ? `${when} · ${ev.location}` : when,
    tag: `${ev.id}:${occ.day}`,
  }
}

// Une tâche datée se rappelle comme un événement "journée" (base 9 h le jour de l'échéance)
function taskAsEvent(t: Task): CalEvent {
  return {
    id: 'task:' + t.id,
    title: 'À faire : ' + t.title,
    start_local: t.due_date!,
    end_local: t.due_date!,
    all_day: true,
    location: '',
    notes: '',
    owner: t.owner,
    rec_freq: 'none',
    rec_interval: 1,
    rec_until: null,
    exdates: [],
    reminder_minutes: t.reminder_minutes,
    category: '',
    kind: 'event',
    birth_year: null,
    updated_at: t.updated_at,
  }
}

export type SubRow = PushSub & { member_id: string }

export async function deliver(env: Env, subs: SubRow[], msg: unknown): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0
  let sent = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        const status = await sendPush(env, sub, msg)
        if (status === 404 || status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
        } else if (status >= 200 && status < 300) {
          sent++
        } else {
          console.error('push refusé', status, new URL(sub.endpoint).host)
        }
      } catch (e) {
        console.error('push en échec', e)
      }
    }),
  )
  return sent
}

export async function runReminders(env: Env): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return
  const now = localNow(env.TZ_NAME)
  const last = await getMeta(env, LAST_RUN)
  let after = last ? parseLocal(last) : new Date(now.getTime() - 60_000)
  if (now.getTime() - after.getTime() > MAX_CATCH_UP) after = new Date(now.getTime() - MAX_CATCH_UP)
  // Heure rejouée lors du passage à l'heure d'hiver : rien de nouveau à envoyer
  if (after >= now) return

  const tasks = (await allTasks(env)).filter((t) => !t.done && t.due_date && t.reminder_minutes != null)
  const due = dueReminders([...(await allEvents(env)), ...tasks.map(taskAsEvent)], after, now)
  // Enregistré avant l'envoi : mieux vaut un rappel manqué qu'un rappel en double
  await setMeta(env, LAST_RUN, fmtLocal(now))
  if (!due.length) return

  const subs = (await env.DB.prepare('SELECT * FROM push_subscriptions').all<SubRow>()).results
  for (const occ of due) {
    const owner = occ.event.owner
    await deliver(env, owner === BOTH ? subs : subs.filter((s) => s.member_id === owner), message(occ))
  }
}
