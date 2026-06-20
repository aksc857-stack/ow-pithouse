import { fr, type TKey } from './fr'
import { en } from './en'
import { pt } from './pt'

export type Lang = 'fr' | 'en' | 'pt'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português (BR)' },
]

export const DICTS: Record<Lang, Partial<Record<TKey, string>>> = { fr, en, pt }

export type { TKey }
export { fr }
