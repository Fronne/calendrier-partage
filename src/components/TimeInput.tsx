import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'

const pad = (n: number) => String(n).padStart(2, '0')

// Cadran dessiné dans un carré de 256 : centre, rayon des heures 1-12 (et des minutes), rayon des heures 13-00
const SIZE = 256
const C = SIZE / 2
const R_OUT = 100
const R_IN = 62

/** Point du cadran à `turn` tours depuis midi, à la distance `r` du centre. */
const at = (turn: number, r: number) => {
  const a = turn * 2 * Math.PI
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}

const isInner = (hour: number) => hour === 0 || hour > 12

interface Props {
  /** « HH:MM » */
  value: string
  label: string
  onChange: (time: string) => void
}

/**
 * Heure choisie sur une horloge dessinée par l'application : celle du navigateur, sur Android,
 * coupait son bouton de validation, et le champ natif rognait le dernier chiffre.
 */
export default function TimeInput({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="time-btn" aria-label={`${label} : ${value}`} onClick={() => setOpen(true)}>
        {value}
      </button>
      {open && (
        <Clock
          value={value}
          label={label}
          onClose={() => setOpen(false)}
          onPick={(t) => {
            setOpen(false)
            onChange(t)
          }}
        />
      )}
    </>
  )
}

interface ClockProps {
  value: string
  label: string
  onPick: (time: string) => void
  onClose: () => void
}

function Clock({ value, label, onPick, onClose }: ClockProps) {
  const [h0, m0] = (value || '09:00').split(':').map(Number)
  const [hour, setHour] = useState(h0)
  const [minute, setMinute] = useState(m0)
  const [mode, setMode] = useState<'h' | 'm'>('h')
  const face = useRef<SVGSVGElement>(null)
  /** Appui en cours : point de départ, et s'il est devenu un glissement */
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  useEffect(() => face.current?.focus(), [])

  const read = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * SIZE - C
    const y = ((e.clientY - box.top) / box.height) * SIZE - C
    const turn = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1
    if (mode === 'm') return setMinute(Math.round(turn * 60) % 60)
    const i = Math.round(turn * 12) % 12
    const inner = Math.hypot(x, y) < (R_OUT + R_IN) / 2
    setHour(inner ? (i === 0 ? 0 : i + 12) : i === 0 ? 12 : i)
  }

  const down = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { x: e.clientX, y: e.clientY, moved: false }
    read(e)
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const p = press.current
    if (!p) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true
    read(e)
  }
  const up = () => {
    const p = press.current
    if (!p) return
    press.current = null
    if (mode === 'h') setMode('m')
    // Un simple toucher vise un chiffre du cadran ; la minute exacte se règle en glissant
    else if (!p.moved) setMinute((m) => (Math.round(m / 5) * 5) % 60)
  }

  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return onClose()
    const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step || e.target !== face.current) return
    e.preventDefault()
    if (mode === 'h') setHour((h) => (h + step + 24) % 24)
    else setMinute((m) => (m + step + 60) % 60)
  }

  const labels =
    mode === 'h'
      ? Array.from({ length: 24 }, (_, v) => ({ v, text: isInner(v) ? pad(v) : String(v), ...at(v / 12, isInner(v) ? R_IN : R_OUT), inner: isInner(v) }))
      : Array.from({ length: 12 }, (_, i) => ({ v: i * 5, text: pad(i * 5), ...at(i / 12, R_OUT), inner: false }))
  const current = mode === 'h' ? hour : minute
  const knob = mode === 'h' ? at(hour / 12, isInner(hour) ? R_IN : R_OUT) : at(minute / 60, R_OUT)

  return createPortal(
    <div
      className="overlay pop-overlay"
      onKeyDown={key}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="clock" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="clock-head">
          <button type="button" className="clock-seg" aria-label="Heures" aria-pressed={mode === 'h'} onClick={() => setMode('h')}>
            {pad(hour)}
          </button>
          <span aria-hidden="true">:</span>
          <button type="button" className="clock-seg" aria-label="Minutes" aria-pressed={mode === 'm'} onClick={() => setMode('m')}>
            {pad(minute)}
          </button>
        </div>
        <svg
          ref={face}
          className="clock-face"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          tabIndex={0}
          role="slider"
          aria-label={mode === 'h' ? 'Heures' : 'Minutes'}
          aria-valuemin={0}
          aria-valuemax={mode === 'h' ? 23 : 59}
          aria-valuenow={current}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <circle className="dial" cx={C} cy={C} r={C} />
          <line className="hand" x1={C} y1={C} x2={knob.x} y2={knob.y} />
          <circle className="knob" cx={C} cy={C} r={4} />
          <circle className="knob" cx={knob.x} cy={knob.y} r={18} />
          {labels.map((l) => (
            <text key={l.v} x={l.x} y={l.y} className={(l.inner ? 'inner' : '') + (l.v === current ? ' on' : '')}>
              {l.text}
            </text>
          ))}
          {/* Minute entre deux chiffres du cadran : un point la repère dans la pastille */}
          {mode === 'm' && minute % 5 !== 0 && <circle className="tick" cx={knob.x} cy={knob.y} r={3} />}
        </svg>
        <div className="clock-actions">
          <button type="button" className="link" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="save" onClick={() => onPick(`${pad(hour)}:${pad(minute)}`)}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
