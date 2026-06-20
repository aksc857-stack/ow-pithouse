import type { PageId } from '@/types'
import { useNav, type NavItem } from '@/context/NavContext'

// Entrées du bas — fixes, toujours visibles (Réglages héberge la config du menu).
const BOTTOM_NAV: NavItem[] = [
  { id: 'themes',   icon: 'ti-palette',  label: 'Thème' },
  { id: 'settings', icon: 'ti-settings', label: 'Réglages' },
]

interface SidebarProps {
  page: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ page, onNavigate }: SidebarProps) {
  const { items, isHidden } = useNav()

  const renderItem = (item: NavItem) => (
    <div
      key={item.id}
      className={`sidebar__item ${page === item.id ? 'active' : ''}`}
      onClick={() => onNavigate(item.id)}
      role="button"
      tabIndex={0}
    >
      <i className={`ti ${item.icon}`} aria-hidden="true" />
      <span>{item.label}</span>
    </div>
  )

  return (
    <nav className="sidebar">
      {items.filter((it) => !isHidden(it.id)).map(renderItem)}
      <div className="sidebar__spacer" />
      {BOTTOM_NAV.map(renderItem)}
    </nav>
  )
}
