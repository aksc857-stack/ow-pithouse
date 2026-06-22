import { useState, useCallback } from 'react'

/** Onglet actif mémorisé (persisté dans localStorage, survit au redémarrage).
 *
 *  Chaque menu à onglets passe une `key` unique + la liste des onglets valides
 *  et l'onglet par défaut. Au retour sur le menu, le dernier onglet ouvert est
 *  restauré ; une valeur stockée devenue invalide retombe sur le défaut. */
export function usePersistentTab<T extends string>(
  key: string,
  valid: readonly T[],
  fallback: T,
): [T, (v: T) => void] {
  const storeKey = `ow_tab_${key}`
  const [tab, setTab] = useState<T>(() => {
    const saved = localStorage.getItem(storeKey)
    return saved && (valid as readonly string[]).includes(saved) ? (saved as T) : fallback
  })
  const set = useCallback((v: T) => {
    setTab(v)
    localStorage.setItem(storeKey, v)
  }, [storeKey])
  return [tab, set]
}
