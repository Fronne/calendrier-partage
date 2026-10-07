import { useEffect, useRef } from 'react'

// Le geste « retour » du téléphone remonte l'historique du navigateur ; sans rien dedans, il quitte l'application.
// Chaque panneau ouvert y garde donc une étape : le geste la consomme, et on referme le panneau à la place.

/** Panneaux ouverts, du plus ancien au plus récent : le retour s'adresse au dernier. */
const layers: { onBack: () => void }[] = []
/** Un retour que nous avons demandé nous-mêmes est en route (étapes de panneaux refermés autrement). */
let rewinding = false
let scheduled = false

/** Nombre d'étapes de panneaux sous la page affichée. */
const depth = () => (history.state as { depth?: number } | null)?.depth ?? 0

// Page rechargée panneau ouvert : son étape n'a plus de panneau, on repart de zéro
if (depth()) history.replaceState(null, '')

/** Remet autant d'étapes dans l'historique qu'il y a de panneaux ouverts. */
function reconcile() {
  scheduled = false
  if (rewinding) return
  const have = depth()
  for (let d = have + 1; d <= layers.length; d++) history.pushState({ depth: d }, '')
  if (have > layers.length) {
    rewinding = true
    history.go(layers.length - have)
  }
}

// Plusieurs panneaux peuvent s'ouvrir ou se fermer d'un coup : on ajuste l'historique une seule fois, après
function schedule() {
  if (scheduled) return
  scheduled = true
  window.setTimeout(reconcile)
}

window.addEventListener('popstate', () => {
  if (rewinding) {
    rewinding = false
    return reconcile()
  }
  const top = layers[layers.length - 1]
  if (!top || depth() >= layers.length) return
  // L'étape vient d'être consommée : on la remet tant que le panneau est là (il peut refuser de se fermer)
  reconcile()
  top.onBack()
})

/** Tant que `active`, le geste « retour » du téléphone appelle `onBack` au lieu de quitter l'application. */
export function useBackClose(onBack: () => void, active = true) {
  const latest = useRef(onBack)
  latest.current = onBack

  useEffect(() => {
    if (!active) return
    const layer = { onBack: () => latest.current() }
    layers.push(layer)
    schedule()
    return () => {
      layers.splice(layers.indexOf(layer), 1)
      schedule()
    }
  }, [active])
}
