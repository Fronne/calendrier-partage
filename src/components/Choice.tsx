import { useState } from 'react'
import { createPortal } from 'react-dom'

export interface Option {
  value: string
  label: string
  /** Filet au-dessus : sépare deux familles de choix */
  divider?: boolean
}

interface Props {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}

/** Liste de choix dans une petite fenêtre de l'application, à la place de la liste native du téléphone. */
export default function Choice({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <>
      <button type="button" className="choice" aria-haspopup="listbox" aria-label={`${label} : ${current?.label ?? ''}`} onClick={() => setOpen(true)}>
        <span>{current?.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className="overlay pop-overlay"
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            <div className="pop" role="listbox" aria-label={label} onClick={(e) => e.stopPropagation()}>
              <strong className="pop-title">{label}</strong>
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  autoFocus={o.value === value}
                  className={o.divider ? 'pop-item divider' : 'pop-item'}
                  onClick={() => {
                    setOpen(false)
                    onChange(o.value)
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === value && (
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path d="m4 9.5 3.2 3.2L14 5.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
