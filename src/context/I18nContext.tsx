import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { DICTS, LANGS, fr, type Lang, type TKey } from '@/locales'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Traduit une clé ; remplace les {var} par vars. Fallback : langue → FR → clé. */
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

const isLang = (v: string | null): v is Lang => !!v && LANGS.some((l) => l.code === v)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('ow_lang')
    return isLang(stored) ? stored : 'fr'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('ow_lang', l)
  }, [])

  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? fr[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
    return s
  }, [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
