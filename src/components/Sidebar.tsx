import type { PageId } from '@/types'

interface NavItem { id: PageId; icon: string; label: string }

const TOP_NAV: NavItem[] = [
  { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dash' },
  { id: 'odrive',    icon: 'ti-engine',           label: 'ODrive' },
  { id: 'ffb',       icon: 'ti-steering-wheel',   label: 'FFB' },
  { id: 'effects',   icon: 'ti-wave-sine',        label: 'Effets' },
  { id: 'profiles',  icon: 'ti-bookmarks',        label: 'Profils' },
  { id: 'monitor',   icon: 'ti-activity',         label: 'Monitor' },
  { id: 'console',   icon: 'ti-terminal-2',       label: 'Console' },
  { id: 'dfu',       icon: 'ti-download',         label: 'Flash' },
]

const BOTTOM_NAV: NavItem[] = [
  { id: 'themes',   icon: 'ti-palette',  label: 'Thème' },
  { id: 'settings', icon: 'ti-settings', label: 'Réglages' },
]

interface SidebarProps {
  page: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ page, onNavigate }: SidebarProps) {
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
      {TOP_NAV.map(renderItem)}
      <div className="sidebar__spacer" />
      {BOTTOM_NAV.map(renderItem)}
    </nav>
  )
}
