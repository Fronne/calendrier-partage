export type Tab = 'month' | 'agenda' | 'tasks' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'month', label: 'Mois', icon: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z' },
  { id: 'agenda', label: 'À venir', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { id: 'tasks', label: 'Tâches', icon: 'M9 12l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
  { id: 'settings', label: 'Réglages', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4' },
]

export default function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="bottomnav">
      {TABS.map((t) => (
        <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => onChange(t.id)}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
