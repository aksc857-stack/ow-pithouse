import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

const nativeExternals = [
  'serialport',
  '@serialport/parser-readline',
  '@serialport/bindings-cpp',
  'electron',
]

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process → CommonJS
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: nativeExternals,
              output: { format: 'cjs', entryFileNames: 'main.js' },
            },
          },
        },
      },
      {
        // Preload → CommonJS (required for sandboxed contextBridge)
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'cjs', entryFileNames: 'preload.js' },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  base: './',
})
