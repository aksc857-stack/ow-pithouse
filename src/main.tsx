import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { Overlay } from './pages/Overlay'
import { DeviceProvider } from './context/DeviceContext'
import { ThemeProvider } from './context/ThemeContext'
import './styles/global.scss'

const isOverlay = window.location.hash === '#overlay'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DeviceProvider>
        {isOverlay ? <Overlay /> : <App />}
      </DeviceProvider>
    </ThemeProvider>
  </React.StrictMode>
)
