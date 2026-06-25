// src/components/landing/_shared.jsx
/**
 * Shared landing-page primitives — keeps all sections visually consistent
 * and prevents per-section duplication. Importable across landing modules.
 */
import { memo } from 'react'
import { motion } from 'framer-motion'

/* ── Animation presets ───────────────────────────────────────────────────── */
const EASE = [0.22, 1, 0.36, 1]

export const fadeUp = (delay = 0, y = 24) => ({
  initial:    { opacity: 0, y },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
})

export const fadeIn = (delay = 0) => ({
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  transition: { duration: 0.6, delay, ease: EASE },
})

export const slideX = (from = -20, delay = 0) => ({
  initial:    { opacity: 0, x: from },
  animate:    { opacity: 1, x: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
})

export const popIn = (delay = 0) => ({
  initial:    { opacity: 0, scale: 0.92 },
  animate:    { opacity: 1, scale: 1 },
  transition: { duration: 0.5, delay, ease: EASE },
})

/* ── Eyebrow pill — small colored tag above section headings ─────────────── */
export const Eyebrow = memo(function Eyebrow({ children, color = 'blue' }) {
  const palettes = {
    blue:   { bg: '#e8f0f8', fg: '#0F4C81' },
    cyan:   { bg: '#e6f9ff', fg: '#0F4C81' },
    green:  { bg: '#e8f8ef', fg: '#2ECC71' },
    orange: { bg: '#fff3e6', fg: '#FF9F43' },
    slate:  { bg: '#f1f5f9', fg: '#475569' },
  }
  const p = palettes[color] ?? palettes.blue

  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.12em]"
      style={{ background: p.bg, color: p.fg }}
    >
      {children}
    </span>
  )
})

/* ── Section heading — eyebrow + title + subtitle (consistent rhythm) ────── */
export const SectionHeading = memo(function SectionHeading({
  eyebrow,
  eyebrowColor = 'blue',
  title,
  subtitle,
  inView = true,
  align = 'center',
  className = '',
}) {
  const alignment = align === 'center'
    ? 'text-center max-w-2xl mx-auto'
    : 'text-left max-w-xl'

  return (
    <div className={`${alignment} mb-12 lg:mb-16 ${className}`}>
      {eyebrow && (
        <motion.div {...fadeUp(0, 12)} animate={inView ? fadeUp(0).animate : undefined} className="mb-5">
          <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
        </motion.div>
      )}
      <motion.h2
        {...fadeUp(0.08)}
        animate={inView ? fadeUp(0.08).animate : undefined}
        className="font-display font-bold leading-[1.08] mb-4 tracking-[-0.02em]"
        style={{
          color: '#0B1320',
          fontSize: 'clamp(1.875rem, 4vw, 3rem)',
        }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          {...fadeUp(0.16)}
          animate={inView ? fadeUp(0.16).animate : undefined}
          className="text-base sm:text-lg leading-relaxed"
          style={{ color: '#4a5568' }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
})

/* ── Section wrapper — uniform vertical padding ──────────────────────────── */
export const Section = memo(function Section({
  id,
  background = '#ffffff',
  children,
  containerClassName = 'max-w-7xl',
  innerRef,
}) {
  return (
    <section
      id={id}
      ref={innerRef}
      className="py-14 sm:py-20 lg:py-28"
      style={{ background }}
    >
      <div className={`mx-auto px-4 sm:px-6 ${containerClassName}`}>
        {children}
      </div>
    </section>
  )
})
