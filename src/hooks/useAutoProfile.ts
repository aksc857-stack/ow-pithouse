import { useEffect, useRef } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useI18n } from '@/context/I18nContext'
import { loadProfiles, saveProfiles } from '@/lib/profiles'
import { applyProfileSettings } from '@/lib/ffbConfig'

// ── Auto-switch de profil par détection du process du jeu ──────────────────────
// Boucle de fond (toutes les ~4 s) : si activée + carte connectée, liste les
// process en cours et applique le profil dont l'`exe` correspond à un jeu lancé.
// Aucun jeu connu lancé → ne change rien (garde le dernier profil appliqué).
const POLL_MS = 4000

export function useAutoProfile() {
  const { connected, setWheelConfig, pausePolling, appendLog } = useDevice()
  const { t } = useI18n()
  const busyRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      if (cancelled) return
      const enabled = localStorage.getItem('ow_autoprofile') === 'on'
      if (enabled && connected && !busyRef.current && window.ow?.listProcesses) {
        try {
          const running = new Set(await window.ow.listProcesses())
          const profiles = loadProfiles()
          const match = profiles.find((p) => p.exe && p.settings && running.has(p.exe.toLowerCase()))
          const active = profiles.find((p) => p.active)
          if (match && match.id !== active?.id) {
            busyRef.current = true
            const resume = pausePolling()
            try {
              await applyProfileSettings(match.settings!)
              setWheelConfig(match.settings!.wheel)
              saveProfiles(profiles.map((p) => ({ ...p, active: p.id === match.id })))
              appendLog('info', t('prof.autoswitch_log', { name: match.name, exe: match.exe! }))
            } finally {
              resume()
              busyRef.current = false
            }
          }
        } catch { /* scan raté : on réessaiera au prochain tick */ }
      }
      timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [connected, setWheelConfig, pausePolling, appendLog, t])
}
