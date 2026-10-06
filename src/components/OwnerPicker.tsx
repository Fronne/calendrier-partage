import { BOTH, type Member } from '../../shared/types'
import { BOTH_COLOR, tint } from '../colors'

interface Props {
  value: string
  members: Member[]
  onChange: (owner: string) => void
}

export default function OwnerPicker({ value, members, onChange }: Props) {
  const options = [...members.map((m) => ({ id: m.id, label: m.name, color: m.color })), { id: BOTH, label: 'Nous deux', color: BOTH_COLOR }]
  return (
    <div className="segmented">
      {options.map((o) => (
        // Le choix actif prend la couleur de la personne (voir .segmented dans styles.css)
        <button key={o.id} type="button" className={o.id === value ? 'on' : ''} style={tint(o.color)} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
