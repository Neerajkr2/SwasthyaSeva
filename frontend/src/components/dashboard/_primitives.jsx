// src/components/dashboard/_primitives.jsx
/**
 * Dashboard primitives — small, reusable building blocks used across
 * the redesigned in-app screens. All visuals derive from the brand
 * tokens (deep blue #0F4C81, cyan #00C2FF, green #2ECC71, orange #FF9F43).
 */
import { memo } from 'react'

/* ── Brand-aligned tones used by Status & semantic chips ─────────────────── */
export const TONE = {
  brand:  { bg: 'rgba(15,76,129,0.10)', fg: '#0F4C81' },
  cyan:   { bg: 'rgba(0,194,255,0.12)',  fg: '#0F4C81' },
  good:   { bg: 'rgba(46,204,113,0.12)', fg: '#1f9d55' },
  warn:   { bg: 'rgba(255,159,67,0.14)',  fg: '#b86b14' },
  danger: { bg: 'rgba(239,68,68,0.10)',   fg: '#b8463a' },
  slate:  { bg: 'rgba(100,116,139,0.10)', fg: '#475569' },
}

/* ── Tiny status chip ────────────────────────────────────────────────────── */
export const Status = memo(function Status({ tone = 'brand', children }) {
  const t = TONE[tone] ?? TONE.brand
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  )
})

/* ── Inline sparkline — responsive (stretches to fill its container) ────── */
export const Sparkline = memo(function Sparkline({
  data = [], h = 28, color = '#0F4C81', strokeWidth = 1.6,
}) {
  if (!data.length) return null

  // We draw in a fixed 100-unit virtual coordinate space, then scale to
  // 100% of the parent's width via preserveAspectRatio="none". This means
  // the sparkline ALWAYS fits perfectly inside its container, regardless
  // of the actual rendered width.
  const VW = 100
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step  = VW / (data.length - 1 || 1)

  // Inset stroke by half its width so it never clips the top/bottom edge
  const inset = strokeWidth / 2
  const usable = h - strokeWidth

  const points = data.map((v, i) => {
    const x = i * step
    const y = inset + (1 - (v - min) / range) * usable
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

  const area = `0,${h} ${points} ${VW},${h}`

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${VW} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polygon points={area} fill={color} opacity="0.10" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})

/* ── Circular progress ring (for health score, etc.) ─────────────────────── */
export const Ring = memo(function Ring({
  value = 78, size = 108, stroke = 9, color = '#0F4C81', track = '#E6EEF5', children,
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
})

/* ── Card container — single source of truth for app cards ────────────────── */
export const Card = memo(function Card({ children, className = '', style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        borderColor: '#E6EEF5',
        boxShadow: '0 1px 2px rgba(11,19,32,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
})

/* ── Eyebrow label (the small uppercase kicker) ──────────────────────────── */
export const Kicker = memo(function Kicker({ children, className = '', style = {} }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`}
      style={{ color: '#94a3b8', ...style }}
    >
      {children}
    </span>
  )
})

/* ── Section heading inside a card ───────────────────────────────────────── */
export const CardHeading = memo(function CardHeading({ kicker, title, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        {kicker && <div className="mb-1.5"><Kicker>{kicker}</Kicker></div>}
        <h3 className="font-display font-bold text-lg leading-tight" style={{ color: '#0B1320' }}>
          {title}
        </h3>
      </div>
      {action}
    </div>
  )
})

/* ── Compact icon button ─────────────────────────────────────────────────── */
export const IconButton = memo(function IconButton({ children, onClick, label, badge = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-brand-blue hover:bg-slate-50 transition-colors border border-brand-border bg-white"
    >
      {children}
      {badge && (
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
          style={{ background: '#0F4C81' }}
        />
      )}
    </button>
  )
})
