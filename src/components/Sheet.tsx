import type { FormEvent, ReactNode } from 'react'

interface Props {
  title: string
  busy?: boolean
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
}

/** Panneau de saisie qui monte du bas de l'écran. */
export default function Sheet({ title, busy, onClose, onSubmit, children }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!busy) onSubmit()
  }
  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
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
        <div className="sheet-body">{children}</div>
      </form>
    </div>
  )
}
