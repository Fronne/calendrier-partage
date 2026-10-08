import { useCallback, useEffect, useMemo, useState } from 'react'
import { nextDue } from '../shared/recurrence'
import { BOTH, type CalEvent, type Occurrence, type Task } from '../shared/types'
import { errorText, getToken, setToken } from './api'
import BottomNav, { type Tab } from './components/BottomNav'
import EventForm from './components/EventForm'
import Icon from './components/Icon'
import Login from './components/Login'
import TaskForm from './components/TaskForm'
import { fmtShortDay, fmtToday, getWeekNums, saveWeekNums, todayKey } from './dates'
import { useBackClose } from './back'
import { dayInfoFor, getZone, saveZone, useSchoolHolidays } from './holidays'
import { disablePush } from './push'
import { StoreCtx, type Store } from './store'
import { CACHE_KEY, QUEUE_KEY, useSync } from './useSync'
import ActivityView from './views/ActivityView'
import AgendaView from './views/AgendaView'
import MonthView from './views/MonthView'
import SearchView from './views/SearchView'
import SettingsView from './views/SettingsView'
import TasksView from './views/TasksView'
import WeekView from './views/WeekView'

type Editing =
  | { kind: 'event'; event?: CalEvent; occ?: Occurrence; day: string; time?: string }
  | { kind: 'task'; task?: Task }
  | null

type CalView = 'month' | 'week'

const TITLES: Record<Tab, string> = { month: 'Calendrier', agenda: 'À venir', tasks: 'Tâches', settings: 'Réglages' }
const VIEW_KEY = 'cal.view'
const TOAST_MS = 6000
/** Dernier changement du journal déjà vu sur ce téléphone (son numéro). */
const SEEN_KEY = 'cal.activity.seen'

export default function App() {
  const [token, setTok] = useState(getToken)

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(QUEUE_KEY)
    setTok(null)
  }, [])

  if (!token) {
    return (
      <Login
        onDone={(t) => {
          setToken(t)
          setTok(t)
        }}
      />
    )
  }
  return <Calendar onLogout={logout} />
}

function Calendar({ onLogout }: { onLogout: () => void }) {
  const { data, offline, stuck, pending, mutate, refresh } = useSync(onLogout)
  // L'application Android se rouvre sur les réglages après un changement de thème (/?reglages=1)
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).has('reglages') ? 'settings' : 'month'))
  const [calView, setCalView] = useState<CalView>(() => (localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month'))
  const [filter, setFilter] = useState('all')
  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [editing, setEditing] = useState<Editing>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const [zone, setZone] = useState(getZone)
  const [weekNums, setWeekNums] = useState(getWeekNums)
  const periods = useSchoolHolidays(zone)
  // Le geste « retour » du téléphone referme la recherche au lieu de quitter l'application
  useBackClose(() => setQuery(null), query !== null)
  // Journal des derniers changements : `seen` est le dernier déjà vu ; ouvert, `journal` garde celui d'avant l'ouverture
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(SEEN_KEY)) || 0)
  const [journal, setJournal] = useState<number | null>(null)
  useBackClose(() => setJournal(null), journal !== null)

  // Le bouton « + » du widget Android ouvre l'application sur un nouveau rendez-vous (/?new=1)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (!params.has('new') && !params.has('reglages')) return
    history.replaceState(null, '', location.pathname)
    if (params.has('new')) setEditing({ kind: 'event', day: todayKey() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const me = data?.members.find((m) => m.id === data.me)

  const store = useMemo<Store | null>(() => {
    if (!data || !me) return null
    const showToast = (text: string, undo?: () => void) => setToast({ text, undo })
    const putTask = (task: Task, silent = false) =>
      mutate({ method: 'PUT', path: `/tasks/${task.id}`, body: task, silent }).catch((e) => showToast(errorText(e)))
    return {
      me,
      members: [me, ...data.members.filter((m) => m.id !== me.id)],
      events: data.events,
      mutate,
      refresh,
      toast: showToast,
      dayInfo: dayInfoFor(periods),
      openEvent: (occ) => setEditing({ kind: 'event', event: occ.event, occ, day: occ.day }),
      openTask: (task) => setEditing({ kind: 'task', task }),
      toggleTask: async (task) => {
        // Une tâche répétée ne passe pas en « terminée » : elle repart à son échéance suivante
        if (!task.done && task.rec_freq !== 'none' && task.due_date) {
          const next = nextDue(task.due_date, task.rec_freq, task.rec_interval, todayKey())
          await putTask({ ...task, due_date: next })
          showToast(`Fait. Prochaine échéance : ${fmtShortDay(next)}`, () => putTask(task, true))
        } else {
          await putTask({ ...task, done: !task.done })
        }
      },
    }
  }, [data, me, mutate, refresh, periods])

  if (!data || !store) return <div className="center">{offline ? 'Pas de connexion internet.' : 'Chargement…'}</div>

  const shown = (owner: string) => filter === 'all' || owner === BOTH || owner === filter
  const events = data.events.filter((e) => shown(e.owner))
  const tasks = data.tasks.filter((t) => shown(t.owner))
  const searching = query !== null
  const activity = data.activity ?? []
  const unseen = activity.filter((a) => a.member_id !== data.me && a.id > seen).length
  const openJournal = () => {
    setJournal(seen)
    const latest = Math.max(seen, ...activity.map((a) => a.id))
    localStorage.setItem(SEEN_KEY, String(latest))
    setSeen(latest)
  }
  const close = () => setEditing(null)

  const chooseView = (v: CalView) => {
    localStorage.setItem(VIEW_KEY, v)
    setCalView(v)
  }
  const chooseWeekNums = (on: boolean) => {
    saveWeekNums(on)
    setWeekNums(on)
  }
  const chooseZone = (z: string) => {
    saveZone(z)
    setZone(z)
  }

  return (
    <StoreCtx.Provider value={store}>
      <div className="app">
        <header className="topbar">
          {searching ? (
            <div className="search-bar">
              <input type="search" placeholder="Rechercher…" aria-label="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
              <button className="link" onClick={() => setQuery(null)}>
                Fermer
              </button>
            </div>
          ) : journal !== null ? (
            <div className="title-row">
              <div className="titles">
                <span className="eyebrow">Derniers changements</span>
                <h1>Activité</h1>
              </div>
              <button className="link" onClick={() => setJournal(null)}>
                Fermer
              </button>
            </div>
          ) : (
            <div className="title-row">
              <div className="titles">
                <span className="eyebrow">{fmtToday()}</span>
                <h1>{TITLES[tab]}</h1>
              </div>
              {tab === 'month' && (
                <div className="segmented small">
                  <button className={calView === 'month' ? 'on accent' : ''} aria-pressed={calView === 'month'} onClick={() => chooseView('month')}>
                    Mois
                  </button>
                  <button className={calView === 'week' ? 'on accent' : ''} aria-pressed={calView === 'week'} onClick={() => chooseView('week')}>
                    Semaine
                  </button>
                </div>
              )}
              {tab !== 'settings' && (
                <button className="icon-btn" aria-label="Rechercher" onClick={() => setQuery('')}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {tab !== 'settings' && !searching && journal === null && (
            <div className="chips">
              <button className={filter === 'all' ? 'chip on' : 'chip'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                Tous
              </button>
              {store.members.map((m) => (
                <button key={m.id} className={filter === m.id ? 'chip on' : 'chip'} aria-pressed={filter === m.id} onClick={() => setFilter(m.id)}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.name}
                </button>
              ))}
              <button className="chip bell" aria-label={unseen ? `Activité récente : ${unseen} nouveau${unseen > 1 ? 'x' : ''} changement${unseen > 1 ? 's' : ''}` : 'Activité récente'} onClick={openJournal}>
                <Icon name="bell" size={18} />
                {unseen > 0 && <span className="count">{unseen}</span>}
              </button>
            </div>
          )}
        </header>

        {!offline && stuck && pending > 0 && (
          <div className="banner" role="status">
            {pending} modification{pending > 1 ? 's' : ''} pas encore enregistrée{pending > 1 ? 's' : ''} sur le serveur ({stuck}). Nouvel essai
            automatique ; ne vous déconnectez pas, elles seraient perdues.
          </div>
        )}
        {offline && (
          <div className="banner" role="status">
            Hors ligne.
            {pending > 0
              ? ` ${pending} modification${pending > 1 ? 's' : ''} en attente, envoyée${pending > 1 ? 's' : ''} dès le retour du réseau.`
              : ' Vous pouvez continuer à saisir : tout sera envoyé au retour du réseau.'}
          </div>
        )}

        <main className="content">
          {searching ? (
            <SearchView query={query} events={data.events} tasks={data.tasks} />
          ) : journal !== null ? (
            <ActivityView activity={activity} seen={journal} />
          ) : (
            <>
              {tab === 'month' && calView === 'month' && <MonthView events={events} tasks={tasks} selectedDay={selectedDay} onSelectDay={setSelectedDay} weekNums={weekNums} />}
              {tab === 'month' && calView === 'week' && (
                <WeekView
                  events={events}
                  tasks={tasks}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  onNewEvent={(day, time) => setEditing({ kind: 'event', day, time })}
                  weekNums={weekNums}
                />
              )}
              {tab === 'agenda' && <AgendaView events={events} tasks={tasks} />}
              {tab === 'tasks' && <TasksView tasks={tasks} />}
              {tab === 'settings' && (
                <SettingsView
                  data={data}
                  zone={zone}
                  onZone={chooseZone}
                  weekNums={weekNums}
                  onWeekNums={chooseWeekNums}
                  onLogout={async () => {
                    await disablePush().catch(() => {})
                    onLogout()
                  }}
                />
              )}
            </>
          )}
        </main>

        {tab !== 'settings' && !searching && journal === null && (
          <button
            className="fab"
            aria-label={tab === 'tasks' ? 'Nouvelle tâche' : 'Nouveau rendez-vous'}
            onClick={() => setEditing(tab === 'tasks' ? { kind: 'task' } : { kind: 'event', day: tab === 'month' ? selectedDay : todayKey() })}
          >
            <Icon name="plus" size={28} />
          </button>
        )}

        {toast && (
          <div className="toast" role="status">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo!()
                  setToast(null)
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}

        <BottomNav
          tab={tab}
          onChange={(t) => {
            setQuery(null)
            setJournal(null)
            setTab(t)
          }}
        />

        {editing?.kind === 'event' && <EventForm event={editing.event} occ={editing.occ} day={editing.day} time={editing.time} onClose={close} />}
        {editing?.kind === 'task' && <TaskForm task={editing.task} onClose={close} />}
      </div>
    </StoreCtx.Provider>
  )
}
