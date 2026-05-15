// src/components/common/Logo.jsx
/**
 * SwasthyaSeva Logo — leaf-petal mark
 *
 * Brand analysis:
 * ───────────────
 * The landing UI is built on two anchor colors:
 *   • #0F4C81  (deep brand blue   — trust, clinical authority)
 *   • #00C2FF  (cyan accent       — modern, fresh, AI-forward)
 *
 * The previous logo introduced teal hues (#20B2AA, #2EC4B6) that
 * appeared nowhere else in the system, so the mark felt detached.
 * The mark below uses ONLY the existing brand anchors, alternating
 * them across four leaf-petals for a cohesive, premium feel that
 * is healthcare-focused, trustworthy, and immediately memorable.
 *
 * The shape is a four-petal "blooming" mark (life / wellness),
 * each petal a true leaf form — pointed inner tip, rounded outer
 * lobe — drawn with cubic-bezier curves (not rounded rectangles).
 */
import { memo } from 'react'

const BRAND_DEEP   = '#0F4C81'
const BRAND_BRIGHT = '#00C2FF'

/* ── Icon ────────────────────────────────────────────────────────────────── */
export const LogoIcon = memo(function LogoIcon({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SwasthyaSeva logo"
    >
      {/* Top-left petal — deep blue (trust) */}
      <path
        d="M18.4 18.4 C 18 9 14 4 2 2 C 4 14 9 18 18.4 18.4 Z"
        fill={BRAND_DEEP}
      />
      {/* Top-right petal — cyan (innovation) */}
      <path
        d="M21.6 18.4 C 31 18 36 14 38 2 C 26 4 22 9 21.6 18.4 Z"
        fill={BRAND_BRIGHT}
      />
      {/* Bottom-left petal — cyan */}
      <path
        d="M18.4 21.6 C 18 31 14 36 2 38 C 4 26 9 22 18.4 21.6 Z"
        fill={BRAND_BRIGHT}
      />
      {/* Bottom-right petal — deep blue */}
      <path
        d="M21.6 21.6 C 31 22 36 26 38 38 C 26 36 22 31 21.6 21.6 Z"
        fill={BRAND_DEEP}
      />
    </svg>
  )
})

/* ── Wordmark + Icon (default) ───────────────────────────────────────────── */
export const LogoFull = memo(function LogoFull({ height = 32, className = '' }) {
  const fontSize = Math.round(height * 0.7)

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={height} />
      <span
        className="font-display font-bold leading-none whitespace-nowrap"
        style={{
          fontSize,
          color: '#0B1320',
          letterSpacing: '-0.02em',
        }}
      >
        Swasthya
        <span style={{ color: BRAND_DEEP }}>Seva</span>
      </span>
    </div>
  )
})

/* ── White variant (for dark backgrounds) ────────────────────────────────── */
export const LogoFullWhite = memo(function LogoFullWhite({ height = 32, className = '' }) {
  const fontSize = Math.round(height * 0.7)

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={height} />
      <span
        className="font-display font-bold leading-none whitespace-nowrap"
        style={{
          fontSize,
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}
      >
        Swasthya
        <span style={{ color: BRAND_BRIGHT }}>Seva</span>
      </span>
    </div>
  )
})

export default LogoFull
