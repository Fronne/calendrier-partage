import { createContext, useContext } from 'react'
import type { CalEvent, Member, Occurrence, Task } from '../shared/types'
import type { DayInfo } from './holidays'
import type { Mutate } from './useSync'

/** Ce dont presque tous les écrans ont besoin, sans le faire passer de composant en composant. */
export interface Store {
  me: Member
  /** Moi d'abord, puis l'autre */
  members: Member[]
  /** Tous les rendez-vous, sans le filtre par personne */
  events: CalEvent[]
  mutate: Mutate
  /** Recharge le calendrier depuis le serveur */
  refresh: () => Promise<void>
  /** Message bref en bas d'écran, avec un bouton « Annuler » si `undo` est fourni */
  toast: (text: string, undo?: () => void) => void
  dayInfo: (day: string) => DayInfo
  openEvent: (occ: Occurrence) => void
  openTask: (task: Task) => void
  toggleTask: (task: Task) => void
}

export const StoreCtx = createContext<Store>(null!)

export const useStore = () => useContext(StoreCtx)
