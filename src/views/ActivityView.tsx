import { expand } from '../../shared/recurrence'
import type { Activity, CalEvent } from '../../shared/types'
import { colorOf, tint } from '../colors'
import { Empty } from '../components/Items'
import { addDays, fmtAgo, todayKey } from '../dates'
import { useStore } from '../store'

interface Props {
  activity: Activity[]
  /** Dernier changement déjà vu avant d'ouvrir cet écran : les suivants sont signalés comme nouveaux */
  seen: number
}

/** Jusqu'où chercher la prochaine date d'un rendez-vous répété. */
const LOOK_AHEAD_DAYS = 730

/** Journal des derniers changements, pour qui a manqué ou effacé une notification. */
export default function ActivityView({ activity, seen }: Props) {
  const { me, members, events, openEvent } = useStore()
  const today = todayKey()

  // Prochaine date à venir ; à défaut (rendez-vous passé), sa date d'origine
  const occOf = (e: CalEvent) => expand(e, today, addDays(today, LOOK_AHEAD_DAYS))[0] ?? expand(e, e.start_local.slice(0, 10), e.start_local.slice(0, 10))[0]

  if (!activity.length) return <Empty icon="🕊️">Aucun changement récent.</Empty>

  return (
    <div className="items journal">
      {activity.map((a) => {
        const who = a.member_id === me.id ? 'Vous' : (members.find((m) => m.id === a.member_id)?.name ?? "Quelqu'un")
        // « Vous avez ajouté… » : l'action est enregistrée à la troisième personne (« a ajouté… »)
        const action = a.member_id === me.id ? a.action.replace(/^a /, 'avez ') : a.action
        const event = a.event_id ? events.find((e) => e.id === a.event_id) : undefined
        const occ = event && occOf(event)
        const fresh = a.member_id !== me.id && a.id > seen
        const content = (
          <>
            <span className="badge">
              <i />
            </span>
            <span className="grow">
              <span className="item-title">
                {who} {action}
              </span>
              <span className="sub">{a.body}</span>
              <span className="sub">{fmtAgo(a.created_at)}</span>
            </span>
            {fresh && <span className="fresh">Nouveau</span>}
          </>
        )
        const style = tint(colorOf(a.member_id, members))
        return occ ? (
          <button key={a.id} className="item" style={style} onClick={() => openEvent(occ)}>
            {content}
          </button>
        ) : (
          <div key={a.id} className="item" style={style}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
