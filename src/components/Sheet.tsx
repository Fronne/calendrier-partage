import { useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'

// Glissement vers le bas : distance avant qu'il s'engage, puis distance ou vitesse (px/ms) qui ferme le panneau
const START_PX = 8
const CLOSE_PX = 110
const CLOSE_SPEED = 0.5
const SETTLE_MS = 220

interface Props {
  title: string
  busy?: boolean
  /** Saisie en cours : fermé d'un geste, le panneau demande s'il faut l'enregistrer */
  dirty?: boolean
  onClose: () => void
  /** Renvoie false (tout de suite ou plus tard) quand rien n'a été enregistré */
  onSubmit: () => unknown
  children: ReactNode
}

/** Panneau de saisie qui monte du bas de l'écran ; on le referme aussi en le tirant vers le bas. */
export default function Sheet({ title, busy, dirty, onClose, onSubmit, children }: Props) {
  const [asking, setAsking] = useState(false)
  const overlay = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLFormElement>(null)
  const body = useRef<HTMLDivElement>(null)
  /** Doigt posé : point et instant de départ, et si le panneau a commencé à suivre */
  const drag = useRef<{ x: number; y: number; t: number; on: boolean } | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!busy) onSubmit()
  }

  /** Décale le panneau de `dy` pixels et éclaircit le fond d'autant. */
  const place = (dy: number) => {
    const el = sheet.current
    if (!el) return
    el.style.transform = dy ? `translateY(${dy}px)` : ''
    overlay.current?.style.setProperty('--dim', String(Math.max(0, 1 - dy / el.offsetHeight)))
  }

  const start = (e: TouchEvent) => {
    drag.current = null
    const target = e.target as Element
    // L'horloge et les listes de choix sont ailleurs dans la page, mais leurs événements remontent jusqu'ici
    if (busy || e.touches.length !== 1 || !sheet.current?.contains(target)) return
    // Dans le formulaire, le doigt fait d'abord défiler ; le panneau ne suit que si on est tout en haut
    if (body.current?.contains(target) && (body.current.scrollTop > 0 || target.closest('textarea'))) return
    sheet.current.classList.remove('settling')
    const t = e.touches[0]
    drag.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, on: false }
  }

  const move = (e: TouchEvent) => {
    const d = drag.current
    if (!d) return
    const t = e.touches[0]
    const dy = t.clientY - d.y
    if (!d.on) {
      // Vers le haut ou de côté : ce n'est pas notre geste
      if (dy < -START_PX || Math.abs(t.clientX - d.x) > START_PX) return void (drag.current = null)
      if (dy < START_PX) return
      d.on = true
    }
    place(Math.max(0, dy))
  }

  const end = (e: TouchEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.on || !sheet.current) return
    const dy = e.changedTouches[0].clientY - d.y
    const flick = dy > START_PX * 4 && dy / (e.timeStamp - d.t) > CLOSE_SPEED
    if (e.type === 'touchend' && (dy > CLOSE_PX || flick)) leave()
    else settle(0)
  }

  /** Laisse le panneau finir sa course : à sa place (0) ou sous l'écran. */
  const settle = (dy: number) => {
    sheet.current?.classList.add('settling')
    place(dy)
  }

  // Un geste ou un toucher à côté peut partir tout seul : le panneau s'en va,
  // mais on ne perd pas une saisie sans demander quoi en faire
  const leave = () => {
    settle(Math.ceil(sheet.current?.getBoundingClientRect().height ?? 0))
    if (dirty) setAsking(true)
    else window.setTimeout(onClose, SETTLE_MS)
  }

  const back = () => {
    setAsking(false)
    settle(0)
  }

  const saveAndClose = async () => {
    setAsking(false)
    // Enregistrement refusé ou raté : le formulaire revient, avec son message d'erreur
    if ((await onSubmit()) === false) settle(0)
  }

  return (
    <div ref={overlay} className="overlay" onClick={leave}>
      <form
        ref={sheet}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        onTouchCancel={end}
      >
        <span className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <button type="button" className="link" onClick={onClose}>
            Annuler
          </button>
          <strong>{title}</strong>
          <button type="submit" className="save" disabled={busy}>
            Enregistrer
          </button>
        </div>
        <div ref={body} className="sheet-body">
          {children}
        </div>
        {asking &&
          createPortal(
            <div
              className="overlay pop-overlay"
              onClick={(e) => {
                e.stopPropagation()
                back()
              }}
            >
              <div className="pop" role="alertdialog" aria-modal="true" aria-label="Enregistrer les modifications ?" onClick={(e) => e.stopPropagation()}>
                <p className="pop-text">Enregistrer les modifications ?</p>
                <div className="pop-actions">
                  <button type="button" className="danger" onClick={onClose}>
                    Abandonner
                  </button>
                  <button type="button" className="save" autoFocus onClick={saveAndClose}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </form>
    </div>
  )
}
