// ── Stockage partagé des profils ──────────────────────────────────────────────
// Source unique pour lire/écrire la liste des profils (localStorage) + un event
// pour que toutes les vues (carte Dashboard, menu Profils, auto-switch) restent
// synchronisées en direct, sans attendre un remontage de page.
import type { GameProfile } from '@/types'

const KEY = 'ow_profiles'
export const PROFILES_EVENT = 'ow:profiles'

export function loadProfiles(): GameProfile[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveProfiles(next: GameProfile[]): void {
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(PROFILES_EVENT))
}
