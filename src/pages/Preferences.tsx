import { useRef, useState } from 'react'
import { useTheme, ACCENT_PRESETS } from '@/context/ThemeContext'
import { useDevice } from '@/context/DeviceContext'
import { useNav } from '@/context/NavContext'
import { useI18n } from '@/context/I18nContext'
import { LANGS, type Lang, type TKey } from '@/locales'
import { Toggle } from '@/components/ui'
import { Dfu } from '@/pages/Tools'

// ── Themes ────────────────────────────────────────────────────────────────────
export function Themes() {
  const { accent, setAccent } = useTheme()
  const { t } = useI18n()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('theme.title')}</div>
          <div className="page-head__sub">{t('theme.sub')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-palette" />{t('theme.accent')}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setAccent(p.value)}
              aria-label={p.name}
              style={{
                width: 40, height: 40, borderRadius: 'var(--r-md)',
                background: p.value, cursor: 'pointer',
                border: accent === p.value ? '2px solid var(--text)' : '2px solid transparent',
              }}
            />
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.7 }}>
          {t('theme.accent_desc')}
        </p>
      </div>
    </>
  )
}

// ── Personnalisation du menu latéral ────────────────────────────────────────────
function NavCustomizer() {
  const { items, isHidden, reorder, toggleHidden, reset } = useNav()
  const { t } = useI18n()
  const dragIndex = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const onDrop = (to: number) => {
    if (dragIndex.current !== null) reorder(dragIndex.current, to)
    dragIndex.current = null
    setOverIndex(null)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <i className="ti ti-menu-2" />{t('set.menu')}
        <button className="btn btn--sm" style={{ marginLeft: 'auto' }} onClick={reset}>
          <i className="ti ti-rotate" /> {t('set.reset')}
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px', lineHeight: 1.7 }}>
        {t('set.menu_desc')}
      </p>

      {items.map((item, i) => {
        const hidden = isHidden(item.id)
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => { dragIndex.current = i }}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
            onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={() => onDrop(i)}
            onDragEnd={() => { dragIndex.current = null; setOverIndex(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6,
              background: 'var(--bg-sunken)',
              border: `1px solid ${overIndex === i ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-sm)',
              opacity: hidden ? 0.45 : 1,
              cursor: 'grab',
            }}
          >
            <i className="ti ti-grip-vertical" style={{ color: 'var(--text-faint)', cursor: 'grab' }} />
            <i className={`ti ${item.icon}`} style={{ color: 'var(--accent)', width: 18, textAlign: 'center' }} />
            <span style={{ flex: 1, fontSize: 13, textDecoration: hidden ? 'line-through' : 'none' }}>{t(`nav.${item.id}` as TKey)}</span>

            <button className="btn btn--sm" title={t('set.menu_up')} disabled={i === 0}
              onClick={() => reorder(i, i - 1)}>
              <i className="ti ti-chevron-up" />
            </button>
            <button className="btn btn--sm" title={t('set.menu_down')} disabled={i === items.length - 1}
              onClick={() => reorder(i, i + 1)}>
              <i className="ti ti-chevron-down" />
            </button>
            <button className="btn btn--sm" title={hidden ? t('set.menu_show') : t('set.menu_hide')}
              onClick={() => toggleHidden(item.id)}>
              <i className={`ti ${hidden ? 'ti-eye-off' : 'ti-eye'}`} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Settings (container à onglets : Réglages + Flash) ─────────────────────────
export function Settings() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'settings' | 'flash'>('settings')
  return (
    <>
      <div className="odrive-tabs">
        <button className={`odrive-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          {t('set.tab_settings')}
        </button>
        <button className={`odrive-tab ${tab === 'flash' ? 'active' : ''}`} onClick={() => setTab('flash')}>
          {t('set.tab_flash')}
        </button>
      </div>
      {tab === 'settings' ? <SettingsForm /> : <Dfu />}
    </>
  )
}

// ── Réglages (connexion, préférences, menu latéral) ───────────────────────────
function SettingsForm() {
  const { ports, connected, port, connect, disconnect } = useDevice()
  const { t, lang, setLang } = useI18n()
  const [selectedPort, setSelectedPort] = useState('')
  const [autoConnect, setAutoConnect] = useState(() => localStorage.getItem('ow_autoconnect') !== 'off')
  const [startup, setStartup] = useState(true)
  const [autoProfile, setAutoProfile] = useState(true)
  const [minimizeTray, setMinimizeTray] = useState(false)

  const toggleAutoConnect = () => {
    const next = !autoConnect
    setAutoConnect(next)
    localStorage.setItem('ow_autoconnect', next ? 'on' : 'off')
  }

  const portLabel = (p: typeof ports[number]) => {
    const isBoard = (p.vendorId ?? '').toLowerCase() === '1209'
    if (isBoard) return `ODrive-Wheel — ${p.path}`
    return p.friendlyName || `${p.path}${p.manufacturer ? ` — ${p.manufacturer}` : ''}`
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('set.title')}</div>
          <div className="page-head__sub">{t('set.sub')}</div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-plug" />{t('set.conn')}</div>

          <div className="stat" style={{ marginBottom: 12 }}>
            <div>
              <span className="stat__label">{t('set.autoconn')}</span>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                {t('set.autoconn_desc')}
              </div>
            </div>
            <Toggle on={autoConnect} onToggle={toggleAutoConnect} />
          </div>

          <div className="field">
            <label>{t('set.com_port')} {autoConnect && t('set.com_port_manual')}</label>
            <select value={connected ? port || '' : selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={connected}>
              <option value="">{t('set.choose_port')}</option>
              {ports.map((p) => (
                <option key={p.path} value={p.path}>{portLabel(p)}</option>
              ))}
            </select>
          </div>
          {connected ? (
            <button className="btn btn--danger" style={{ width: '100%' }} onClick={disconnect}>
              <i className="ti ti-plug-off" /> {t('set.disconnect')}
            </button>
          ) : (
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => selectedPort && connect(selectedPort)} disabled={!selectedPort}>
              <i className="ti ti-plug" /> {t('set.connect')}
            </button>
          )}
        </div>

        <div className="card">
          <div className="card__head"><i className="ti ti-settings" />{t('set.prefs')}</div>

          <div className="field">
            <label>{t('set.language')}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="stat">
            <span className="stat__label">{t('set.startup')}</span>
            <Toggle on={startup} onToggle={() => setStartup(!startup)} />
          </div>
          <div className="stat">
            <span className="stat__label">{t('set.autoprofile')}</span>
            <Toggle on={autoProfile} onToggle={() => setAutoProfile(!autoProfile)} />
          </div>
          <div className="stat">
            <span className="stat__label">{t('set.tray')}</span>
            <Toggle on={minimizeTray} onToggle={() => setMinimizeTray(!minimizeTray)} />
          </div>
        </div>
      </div>

      <NavCustomizer />
    </>
  )
}
