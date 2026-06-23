import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'

// ── Slider ────────────────────────────────────────────────────────────────────
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  format?: (v: number) => string
  onChange: (v: number) => void
  hint?: string   // tooltip natif au survol (icône ?)
}

export function Slider({ label, value, min, max, step = 1, unit = '', format, onChange, hint }: SliderProps) {
  const display = format ? format(value) : `${value}${unit}`
  // Position de remplissage (0..100 %) : la couleur ne va que jusqu'au pouce.
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className="slider">
      <div className="slider__head">
        <span className="slider__name">
          {label}
          {hint && <i className="ti ti-help-circle" title={hint} style={{ marginLeft: 6, color: 'var(--text-faint)', cursor: 'help' }} />}
        </span>
        <span className="slider__val">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        style={{ '--fill': `${fillPct}%` } as CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle} role="switch" aria-checked={on} />
}

// ── TorqueDial — circular SVG gauge ──────────────────────────────────────────
interface TorqueDialProps {
  value: number
  max: number
  accent: string
}

export function TorqueDial({ value, max, accent }: TorqueDialProps) {
  const r = 76
  const circumference = 2 * Math.PI * r
  const arcLength = circumference * 0.75   // 270° arc
  const pct = Math.min(1, Math.abs(value) / max)
  const offset = arcLength - arcLength * pct

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--border)" strokeWidth="12"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round" transform="rotate(135 90 90)" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={accent} strokeWidth="12"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(135 90 90)"
          style={{ transition: 'stroke-dashoffset 0.15s ease' }} />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {Math.abs(value).toFixed(1)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
          Nm / {max.toFixed(1)} max
        </div>
      </div>
    </div>
  )
}

// ── Sparkline — rolling line chart on canvas ─────────────────────────────────
interface SparklineProps {
  value: number
  color: string
  min: number
  max: number
  fill?: boolean
}

export function Sparkline({ value, color, min, max, fill = true }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<number[]>(Array(80).fill((min + max) / 2))

  useEffect(() => {
    dataRef.current.push(value)
    if (dataRef.current.length > 80) dataRef.current.shift()

    const c = canvasRef.current
    if (!c) return
    const w = c.offsetWidth || 300
    const h = c.offsetHeight || 130
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)
    const data = dataRef.current
    const range = max - min || 1

    // Zero line
    if (min < 0) {
      const y0 = h - ((0 - min) / range) * h
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke()
    }

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h * 0.88 - h * 0.06
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    if (fill) {
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
      ctx.globalAlpha = 0.08
      ctx.fillStyle = color
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, [value, color, min, max, fill])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
}

// ── Toast system ──────────────────────────────────────────────────────────────
interface ToastItem { id: number; text: string; type: 'ok' | 'err' }
let toastListeners: ((t: ToastItem) => void)[] = []
let toastId = 0

export function toast(text: string, type: 'ok' | 'err' = 'ok') {
  const item = { id: ++toastId, text, type }
  toastListeners.forEach((l) => l(item))
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  const add = useCallback((item: ToastItem) => {
    setItems((prev) => [...prev, item])
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== item.id)), 3000)
  }, [])

  useEffect(() => {
    toastListeners.push(add)
    return () => { toastListeners = toastListeners.filter((l) => l !== add) }
  }, [add])

  return (
    <div className="toast-wrap">
      {items.map((i) => (
        <div key={i.id} className={`toast ${i.type === 'err' ? 'toast--err' : ''}`}>
          <i className={`ti ti-${i.type === 'err' ? 'alert-circle' : 'check'}`} />
          {i.text}
        </div>
      ))}
    </div>
  )
}
