import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { PageId } from '@/types'

export interface NavItem { id: PageId; icon: string; label: string }

// Liste canonique des entrées réordonnables/masquables du menu latéral.
// Les entrées du bas (Thème, Réglages) sont fixes et toujours visibles —
// masquer « Réglages » empêcherait d'accéder à cette configuration.
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dash' },
  { id: 'ffb',       icon: 'ti-steering-wheel',   label: 'FFB' },
  { id: 'filters',   icon: 'ti-filter',           label: 'Filtres' },
  { id: 'profiles',  icon: 'ti-bookmarks',        label: 'Profils' },
  { id: 'odrive',    icon: 'ti-engine',           label: 'ODrive' },
  { id: 'status',    icon: 'ti-activity',         label: 'Outils' },
]

const DEFAULT_ORDER = NAV_ITEMS.map((i) => i.id)
const ORDER_KEY = 'ow_nav_order'
const HIDDEN_KEY = 'ow_nav_hidden'

/** Fusionne l'ordre stocké avec la liste canonique : retire les ids obsolètes,
 *  et insère les pages nouvellement introduites à LEUR position canonique
 *  (juste après leur voisin de gauche par défaut), pas en bout de liste. */
function loadOrder(): PageId[] {
  let stored: PageId[] = []
  try { stored = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') } catch { stored = [] }
  const result = stored.filter((id) => DEFAULT_ORDER.includes(id))

  for (const id of DEFAULT_ORDER) {
    if (result.includes(id)) continue
    // Insère après le voisin de gauche (dans l'ordre par défaut) déjà présent.
    const defIdx = DEFAULT_ORDER.indexOf(id)
    let insertAt = result.length
    for (let i = defIdx - 1; i >= 0; i--) {
      const pos = result.indexOf(DEFAULT_ORDER[i])
      if (pos >= 0) { insertAt = pos + 1; break }
    }
    result.splice(insertAt, 0, id)
  }
  return result
}

function loadHidden(): PageId[] {
  try {
    const stored: PageId[] = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')
    return stored.filter((id) => DEFAULT_ORDER.includes(id))
  } catch { return [] }
}

interface NavContextValue {
  /** Ordre courant de toutes les entrées réordonnables (visibles + cachées). */
  order: PageId[]
  /** Entrées masquées. */
  hidden: PageId[]
  /** Métadonnées dans l'ordre courant. */
  items: NavItem[]
  isHidden: (id: PageId) => boolean
  reorder: (from: number, to: number) => void
  toggleHidden: (id: PageId) => void
  reset: () => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [order, setOrder] = useState<PageId[]>(loadOrder)
  const [hidden, setHidden] = useState<PageId[]>(loadHidden)

  const persistOrder = (next: PageId[]) => {
    setOrder(next)
    localStorage.setItem(ORDER_KEY, JSON.stringify(next))
  }
  const persistHidden = (next: PageId[]) => {
    setHidden(next)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
  }

  const reorder = useCallback((from: number, to: number) => {
    setOrder((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      localStorage.setItem(ORDER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const toggleHidden = useCallback((id: PageId) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    persistOrder(DEFAULT_ORDER)
    persistHidden([])
  }, [])

  const byId = (id: PageId) => NAV_ITEMS.find((i) => i.id === id)!
  const items = order.map(byId)
  const isHidden = (id: PageId) => hidden.includes(id)

  return (
    <NavContext.Provider value={{ order, hidden, items, isHidden, reorder, toggleHidden, reset }}>
      {children}
    </NavContext.Provider>
  )
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}
