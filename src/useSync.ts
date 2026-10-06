import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyncData } from '../shared/types'
import { api, ApiError } from './api'
import { applyOp, uid, type Op } from './ops'

export const CACHE_KEY = 'cal.data'
export const QUEUE_KEY = 'cal.queue'
const REFRESH_MS = 20_000

function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

export type Mutate = (op: Omit<Op, 'id'>) => Promise<'done' | 'queued'>

/**
 * Charge le calendrier et le garde à jour pendant que l'app est ouverte.
 * Les modifications passent par une file d'attente : sans réseau elles sont affichées
 * tout de suite, conservées sur le téléphone, puis envoyées dès que la connexion revient.
 */
export function useSync(onUnauthorized: () => void) {
  const [server, setServer] = useState<SyncData | null>(() => stored(CACHE_KEY, null))
  const [queue, setQueueState] = useState<Op[]>(() => stored(QUEUE_KEY, []))
  const [offline, setOffline] = useState(false)
  const lastJson = useRef('')
  const queueRef = useRef(queue)
  const flushing = useRef<Promise<void> | null>(null)
  const rejected = useRef(new Map<string, ApiError>())

  const saveQueue = useCallback((q: Op[]) => {
    queueRef.current = q
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
    setQueueState(q)
  }, [])

  // Envoie les modifications en attente, dans l'ordre. S'arrête au premier problème de réseau.
  const flush = useCallback(() => {
    if (flushing.current) return flushing.current
    const run = (async () => {
      while (queueRef.current.length) {
        const op = queueRef.current[0]
        try {
          await api(op.path + (op.silent ? '?silent=1' : ''), op.method, op.body)
        } catch (e) {
          const status = e instanceof ApiError ? e.status : 0
          if (status === 401) return onUnauthorized()
          // Pas de réseau ou serveur en panne : on garde tout et on réessaiera
          if (status === 0 || status === 429 || status >= 500) return setOffline(true)
          // Refusée par le serveur (ex. élément supprimé entre-temps) : inutile d'insister
          rejected.current.set(op.id, e as ApiError)
        }
        saveQueue(queueRef.current.filter((o) => o.id !== op.id))
      }
    })()
    flushing.current = run
    // Libéré après coup, et jamais pendant l'exécution : une file vide se termine avant même l'affectation ci-dessus
    run.finally(() => {
      if (flushing.current === run) flushing.current = null
    })
    return run
  }, [onUnauthorized, saveQueue])

  const refresh = useCallback(async () => {
    await flush()
    try {
      const fresh = await api<SyncData>('/sync')
      const json = JSON.stringify(fresh)
      // Évite de redessiner l'écran toutes les 20 s quand rien n'a changé
      if (json !== lastJson.current) {
        lastJson.current = json
        localStorage.setItem(CACHE_KEY, json)
        setServer(fresh)
      }
      setOffline(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized()
      else setOffline(true)
    }
  }, [flush, onUnauthorized])

  const mutate = useCallback<Mutate>(
    async (op) => {
      const full = { ...op, id: uid() }
      saveQueue([...queueRef.current, full])
      await flush()
      const refused = rejected.current.get(full.id)
      if (refused) {
        rejected.current.delete(full.id)
        throw refused
      }
      if (queueRef.current.some((o) => o.id === full.id)) return 'queued'
      await refresh()
      return 'done'
    },
    [flush, refresh, saveQueue],
  )

  useEffect(() => {
    const whenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    whenVisible()
    const timer = setInterval(whenVisible, REFRESH_MS)
    document.addEventListener('visibilitychange', whenVisible)
    window.addEventListener('focus', whenVisible)
    window.addEventListener('online', whenVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', whenVisible)
      window.removeEventListener('focus', whenVisible)
      window.removeEventListener('online', whenVisible)
    }
  }, [refresh])

  const data = useMemo(() => (server ? queue.reduce(applyOp, server) : null), [server, queue])

  return { data, offline, pending: queue.length, refresh, mutate }
}
