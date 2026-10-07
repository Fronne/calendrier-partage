const PATHS = {
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
}

interface Props {
  name: keyof typeof PATHS
  size?: number
  className?: string
}

/** Pictogramme au trait, du même dessin que ceux de la barre de navigation. Décoratif : le bouton porte le nom. */
export default function Icon({ name, size = 22, className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
