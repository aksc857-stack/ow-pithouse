/// <reference types="vite/client" />

import 'react'

declare module 'react' {
  interface CSSProperties {
    // Electron : zone draggable d'une fenêtre frameless (overlay, titlebar)
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
