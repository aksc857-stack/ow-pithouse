import { useState } from 'react'
import { Titlebar } from '@/components/Titlebar'
import { Sidebar } from '@/components/Sidebar'
import { ToastContainer } from '@/components/ui'
import { Dashboard } from '@/pages/Dashboard'
import { FFB, Filters } from '@/pages/Config'
import { Odrive } from '@/pages/Odrive'
import { Profiles, Status, Console } from '@/pages/Tools'
import { Themes, Settings } from '@/pages/Preferences'
import type { PageId } from '@/types'

const PAGES: Record<PageId, () => JSX.Element> = {
  dashboard: Dashboard,
  odrive: Odrive,
  ffb: FFB,
  filters: Filters,
  profiles: Profiles,
  status: Status,
  console: Console,
  themes: Themes,
  settings: Settings,
}

export function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const PageComponent = PAGES[page]

  return (
    <div className="app">
      <Titlebar />
      <div className="app-body">
        <Sidebar page={page} onNavigate={setPage} />
        <main className="app-main">
          <PageComponent />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
