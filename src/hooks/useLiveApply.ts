import { useCallback, useEffect, useRef } from 'react'

/**
 * Application live debouncée, keyée par identifiant de champ.
 *
 * Bouger un curseur déclenche onChange des dizaines de fois ; on ne veut pas
 * inonder la file série single-flight. Chaque clé (ex: 'range', 'fx.spring')
 * a son propre timer : seules les écritures espacées de `delay` ms partent,
 * et la dernière valeur d'un mouvement continu est toujours envoyée.
 */
export function useLiveApply(delay = 120) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const apply = useCallback((key: string, fn: () => void | Promise<void>) => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key)
      void fn()
    }, delay))
  }, [delay])

  // Purge les timers en attente au démontage.
  useEffect(() => {
    const map = timers.current
    return () => { map.forEach((t) => clearTimeout(t)); map.clear() }
  }, [])

  return apply
}
