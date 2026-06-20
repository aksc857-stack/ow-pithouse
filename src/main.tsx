import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { Overlay } from './pages/Overlay'
import { DeviceProvider } from './context/DeviceContext'
import { ThemeProvider } from './context/ThemeContext'
import { NavProvider } from './context/NavContext'
import { I18nProvider } from './context/I18nContext'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './styles/global.scss'

const isOverlay = window.location.hash === '#overlay'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <DeviceProvider>
          <NavProvider>
            {isOverlay ? <Overlay /> : <App />}
          </NavProvider>
        </DeviceProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
)
